"""
FastAPI main application.
Provides all 7 legal assistance endpoints plus PDF/TXT file upload support.
"""
import io
import logging
from typing import Optional

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

try:
    import PyPDF2
except ImportError:
    PyPDF2 = None

from models import (
    TextRequest, CompareRequest, QnARequest, NextStepsRequest, LawyerPrepRequest,
    SimplifyResponse, RiskResponse, CompareResponse, QnAResponse,
    NextStepsResponse, SummaryResponse, LawyerPrepResponse,
)
from prompts import (
    SYSTEM_PERSONA,
    SIMPLIFY_PROMPT, RISK_PROMPT, COMPARE_PROMPT,
    QNA_PROMPT, NEXT_STEPS_PROMPT, SUMMARY_PROMPT, LAWYER_PREP_PROMPT,
)
from gemini_client import gemini_client

# ─── App Setup ─────────────────────────────────────────────────────────────────

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="LexAI — AI Legal Assistance API",
    description="GenAI-powered legal document analysis and assistance",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    root_path="/api",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Utility Functions ─────────────────────────────────────────────────────────

def extract_text_from_file(file: UploadFile) -> str:
    """Extract text from uploaded PDF or TXT file."""
    content = file.file.read()

    if file.filename.lower().endswith(".pdf"):
        if PyPDF2 is None:
            raise HTTPException(status_code=400, detail="PDF support not installed. Please install PyPDF2.")
        reader = PyPDF2.PdfReader(io.BytesIO(content))
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""
        return text.strip()

    elif file.filename.lower().endswith(".txt"):
        return content.decode("utf-8", errors="replace").strip()

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.filename}. Only PDF and TXT files are supported."
        )


def call_gemini(prompt: str) -> dict:
    """Call Gemini and handle errors gracefully."""
    try:
        return gemini_client.generate(prompt)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Model response parsing error: {str(e)}")
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=f"AI service error: {str(e)}")


# ─── Health Check ──────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "service": "LexAI Legal Assistance API", "version": "1.0.0"}


@app.get("/health", tags=["Health"])
def health():
    return {"status": "healthy"}


# ─── File Upload Endpoint ──────────────────────────────────────────────────────

@app.post("/upload", tags=["Utilities"])
async def upload_file(file: UploadFile = File(...)):
    """Upload a PDF or TXT file and extract its text content."""
    text = extract_text_from_file(file)
    if not text:
        raise HTTPException(status_code=400, detail="Could not extract text from the uploaded file.")
    return {"filename": file.filename, "extracted_text": text, "char_count": len(text)}


# ─── 1. Document Simplifier ────────────────────────────────────────────────────

@app.post("/simplify", response_model=SimplifyResponse, tags=["Features"])
async def simplify_document(request: TextRequest):
    """Simplify a complex legal document into plain English."""
    prompt = SIMPLIFY_PROMPT.format(system=SYSTEM_PERSONA, document=request.text)
    result = call_gemini(prompt)
    return result


@app.post("/simplify/file", response_model=SimplifyResponse, tags=["Features"])
async def simplify_document_file(file: UploadFile = File(...)):
    """Simplify a legal document uploaded as PDF or TXT."""
    text = extract_text_from_file(file)
    prompt = SIMPLIFY_PROMPT.format(system=SYSTEM_PERSONA, document=text)
    result = call_gemini(prompt)
    return result


# ─── 2. Risk & Clause Highlighter ─────────────────────────────────────────────

@app.post("/analyze-risks", response_model=RiskResponse, tags=["Features"])
async def analyze_risks(request: TextRequest):
    """Analyze a legal document for risky clauses, obligations, and inconsistencies."""
    prompt = RISK_PROMPT.format(system=SYSTEM_PERSONA, document=request.text)
    result = call_gemini(prompt)
    return result


@app.post("/analyze-risks/file", response_model=RiskResponse, tags=["Features"])
async def analyze_risks_file(file: UploadFile = File(...)):
    """Analyze risks in a legal document uploaded as PDF or TXT."""
    text = extract_text_from_file(file)
    prompt = RISK_PROMPT.format(system=SYSTEM_PERSONA, document=text)
    result = call_gemini(prompt)
    return result


# ─── 3. Contract Comparison ────────────────────────────────────────────────────

@app.post("/compare", response_model=CompareResponse, tags=["Features"])
async def compare_documents(request: CompareRequest):
    """Compare two legal documents and identify all differences."""
    prompt = COMPARE_PROMPT.format(
        system=SYSTEM_PERSONA,
        label_a=request.label_a,
        label_b=request.label_b,
        document_a=request.document_a,
        document_b=request.document_b,
    )
    result = call_gemini(prompt)
    return result


@app.post("/compare/files", response_model=CompareResponse, tags=["Features"])
async def compare_documents_files(
    file_a: UploadFile = File(...),
    file_b: UploadFile = File(...),
    label_a: str = Form(default="Document A"),
    label_b: str = Form(default="Document B"),
):
    """Compare two legal documents uploaded as PDF or TXT."""
    text_a = extract_text_from_file(file_a)
    text_b = extract_text_from_file(file_b)
    prompt = COMPARE_PROMPT.format(
        system=SYSTEM_PERSONA,
        label_a=label_a,
        label_b=label_b,
        document_a=text_a,
        document_b=text_b,
    )
    result = call_gemini(prompt)
    return result


# ─── 4. Legal Q&A ─────────────────────────────────────────────────────────────

@app.post("/qna", response_model=QnAResponse, tags=["Features"])
async def legal_qna(request: QnARequest):
    """Answer a question based on the provided legal document."""
    prompt = QNA_PROMPT.format(
        system=SYSTEM_PERSONA,
        document=request.document,
        question=request.question,
    )
    result = call_gemini(prompt)
    return result


# ─── 5. Options & Next Steps ──────────────────────────────────────────────────

@app.post("/next-steps", response_model=NextStepsResponse, tags=["Features"])
async def get_next_steps(request: NextStepsRequest):
    """Get legal options and next steps based on a described situation."""
    prompt = NEXT_STEPS_PROMPT.format(
        system=SYSTEM_PERSONA,
        situation=request.situation,
        jurisdiction=request.jurisdiction or "General (not jurisdiction-specific)",
    )
    result = call_gemini(prompt)
    return result


# ─── 6. Summary & Checklist Generator ─────────────────────────────────────────

@app.post("/summarize", response_model=SummaryResponse, tags=["Features"])
async def summarize_document(request: TextRequest):
    """Generate an executive summary and actionable checklist from a legal document."""
    prompt = SUMMARY_PROMPT.format(system=SYSTEM_PERSONA, document=request.text)
    result = call_gemini(prompt)
    return result


@app.post("/summarize/file", response_model=SummaryResponse, tags=["Features"])
async def summarize_document_file(file: UploadFile = File(...)):
    """Summarize a legal document uploaded as PDF or TXT."""
    text = extract_text_from_file(file)
    prompt = SUMMARY_PROMPT.format(system=SYSTEM_PERSONA, document=text)
    result = call_gemini(prompt)
    return result


# ─── 7. Lawyer Prep Assistant ─────────────────────────────────────────────────

@app.post("/lawyer-prep", response_model=LawyerPrepResponse, tags=["Features"])
async def lawyer_prep(request: LawyerPrepRequest):
    """Generate targeted questions and prep materials for a lawyer consultation."""
    prompt = LAWYER_PREP_PROMPT.format(
        system=SYSTEM_PERSONA,
        situation=request.situation,
        document=request.document or "No document provided.",
    )
    result = call_gemini(prompt)
    return result


@app.post("/lawyer-prep/file", response_model=LawyerPrepResponse, tags=["Features"])
async def lawyer_prep_file(
    file: Optional[UploadFile] = File(default=None),
    situation: str = Form(...),
):
    """Prepare lawyer consultation materials with an optional document."""
    document_text = "No document provided."
    if file:
        document_text = extract_text_from_file(file)
    prompt = LAWYER_PREP_PROMPT.format(
        system=SYSTEM_PERSONA,
        situation=situation,
        document=document_text,
    )
    result = call_gemini(prompt)
    return result


# ─── Run ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
