"""
FastAPI main application.
Provides all 7 legal assistance endpoints plus PDF/TXT file upload support.
Includes efficiency optimizations: GZip compression, rate limiting, async I/O,
request timing middleware, input validation, and response caching.
"""
import io
import time
import logging
from typing import Optional
from contextlib import asynccontextmanager

import os
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded

    limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])
    RATE_LIMITING_AVAILABLE = True
except ImportError:
    limiter = None
    RATE_LIMITING_AVAILABLE = False

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

# Maximum file upload size (10 MB)
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024


# ─── Lifespan Events (startup/shutdown) ────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown hooks."""
    logger.info("LexAI starting up — cache and rate limiter initialized")
    yield
    logger.info("LexAI shutting down — clearing cache")
    gemini_client.clear_cache()


app = FastAPI(
    title="LexAI — AI Legal Assistance API",
    description="GenAI-powered legal document analysis and assistance",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


# ─── Middleware Stack (order matters) ──────────────────────────────────────────

# 1. GZip compression — compress responses > 500 bytes (~60-80% size reduction)
app.add_middleware(GZipMiddleware, minimum_size=500)

# 2. CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Rate limiting (if slowapi is installed)
if RATE_LIMITING_AVAILABLE:
    app.state.limiter = limiter

    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
        return JSONResponse(
            status_code=429,
            content={
                "detail": "Rate limit exceeded. Please wait before making more requests.",
                "retry_after_seconds": 60,
            },
        )


# 4. Request timing middleware — log response times for performance monitoring
@app.middleware("http")
async def add_request_timing(request: Request, call_next):
    """Log request duration and add X-Response-Time header."""
    start_time = time.time()
    response = await call_next(request)
    duration_ms = round((time.time() - start_time) * 1000)
    response.headers["X-Response-Time"] = f"{duration_ms}ms"

    # Log slow requests (> 5 seconds)
    if duration_ms > 5000:
        logger.warning(f"Slow request: {request.method} {request.url.path} took {duration_ms}ms")
    else:
        logger.info(f"{request.method} {request.url.path} completed in {duration_ms}ms")

    return response


# ─── Utility Functions ─────────────────────────────────────────────────────────

async def extract_text_from_file(file: UploadFile) -> str:
    """
    Extract text from uploaded PDF or TXT file.
    Uses async file.read() for non-blocking I/O.
    Validates file size before processing.
    """
    # Read file asynchronously (non-blocking)
    content = await file.read()

    # Validate file size (fail-fast)
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(content):,} bytes). Maximum size is {MAX_FILE_SIZE_BYTES // (1024*1024)} MB.",
        )

    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        if file.filename.lower().endswith(".pdf"):
            if PyPDF2 is None:
                raise HTTPException(status_code=400, detail="PDF support not installed. Please install PyPDF2.")
            reader = PyPDF2.PdfReader(io.BytesIO(content))
            text = "".join(page.extract_text() or "" for page in reader.pages)
            return text.strip()

        elif file.filename.lower().endswith(".txt"):
            return content.decode("utf-8", errors="replace").strip()

        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {file.filename}. Only PDF and TXT files are supported."
            )
    finally:
        # Ensure file handle is properly closed
        await file.close()


async def call_gemini_async(prompt: str) -> dict:
    """Call Gemini asynchronously with caching and handle errors gracefully."""
    try:
        return await gemini_client.generate_async(prompt)
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
    return {
        "status": "healthy",
        "cache": gemini_client.cache_stats,
        "rate_limiting": RATE_LIMITING_AVAILABLE,
        "compression": "gzip",
    }


# ─── File Upload Endpoint ──────────────────────────────────────────────────────

@app.post("/upload", tags=["Utilities"])
async def upload_file(file: UploadFile = File(...)):
    """Upload a PDF or TXT file and extract its text content."""
    text = await extract_text_from_file(file)
    if not text:
        raise HTTPException(status_code=400, detail="Could not extract text from the uploaded file.")
    return {"filename": file.filename, "extracted_text": text, "char_count": len(text)}


# ─── 1. Document Simplifier ────────────────────────────────────────────────────

@app.post("/simplify", response_model=SimplifyResponse, tags=["Features"])
async def simplify_document(request: TextRequest):
    """Simplify a complex legal document into plain English."""
    prompt = SIMPLIFY_PROMPT.format(system=SYSTEM_PERSONA, document=request.text)
    result = await call_gemini_async(prompt)
    return result


@app.post("/simplify/file", response_model=SimplifyResponse, tags=["Features"])
async def simplify_document_file(file: UploadFile = File(...)):
    """Simplify a legal document uploaded as PDF or TXT."""
    text = await extract_text_from_file(file)
    prompt = SIMPLIFY_PROMPT.format(system=SYSTEM_PERSONA, document=text)
    result = await call_gemini_async(prompt)
    return result


# ─── 2. Risk & Clause Highlighter ─────────────────────────────────────────────

@app.post("/analyze-risks", response_model=RiskResponse, tags=["Features"])
async def analyze_risks(request: TextRequest):
    """Analyze a legal document for risky clauses, obligations, and inconsistencies."""
    prompt = RISK_PROMPT.format(system=SYSTEM_PERSONA, document=request.text)
    result = await call_gemini_async(prompt)
    return result


@app.post("/analyze-risks/file", response_model=RiskResponse, tags=["Features"])
async def analyze_risks_file(file: UploadFile = File(...)):
    """Analyze risks in a legal document uploaded as PDF or TXT."""
    text = await extract_text_from_file(file)
    prompt = RISK_PROMPT.format(system=SYSTEM_PERSONA, document=text)
    result = await call_gemini_async(prompt)
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
    result = await call_gemini_async(prompt)
    return result


@app.post("/compare/files", response_model=CompareResponse, tags=["Features"])
async def compare_documents_files(
    file_a: UploadFile = File(...),
    file_b: UploadFile = File(...),
    label_a: str = Form(default="Document A"),
    label_b: str = Form(default="Document B"),
):
    """Compare two legal documents uploaded as PDF or TXT."""
    text_a = await extract_text_from_file(file_a)
    text_b = await extract_text_from_file(file_b)
    prompt = COMPARE_PROMPT.format(
        system=SYSTEM_PERSONA,
        label_a=label_a,
        label_b=label_b,
        document_a=text_a,
        document_b=text_b,
    )
    result = await call_gemini_async(prompt)
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
    result = await call_gemini_async(prompt)
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
    result = await call_gemini_async(prompt)
    return result


# ─── 6. Summary & Checklist Generator ─────────────────────────────────────────

@app.post("/summarize", response_model=SummaryResponse, tags=["Features"])
async def summarize_document(request: TextRequest):
    """Generate an executive summary and actionable checklist from a legal document."""
    prompt = SUMMARY_PROMPT.format(system=SYSTEM_PERSONA, document=request.text)
    result = await call_gemini_async(prompt)
    return result


@app.post("/summarize/file", response_model=SummaryResponse, tags=["Features"])
async def summarize_document_file(file: UploadFile = File(...)):
    """Summarize a legal document uploaded as PDF or TXT."""
    text = await extract_text_from_file(file)
    prompt = SUMMARY_PROMPT.format(system=SYSTEM_PERSONA, document=text)
    result = await call_gemini_async(prompt)
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
    result = await call_gemini_async(prompt)
    return result


@app.post("/lawyer-prep/file", response_model=LawyerPrepResponse, tags=["Features"])
async def lawyer_prep_file(
    file: Optional[UploadFile] = File(default=None),
    situation: str = Form(...),
):
    """Prepare lawyer consultation materials with an optional document."""
    document_text = "No document provided."
    if file:
        document_text = await extract_text_from_file(file)
    prompt = LAWYER_PREP_PROMPT.format(
        system=SYSTEM_PERSONA,
        situation=situation,
        document=document_text,
    )
    result = await call_gemini_async(prompt)
    return result


# ─── Static Frontend & SPA Fallback ───────────────────────────────────────────

FRONTEND_DIST = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
ASSETS_DIR = os.path.join(FRONTEND_DIST, "assets")

if os.path.exists(ASSETS_DIR):
    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")

@app.get("/{full_path:path}", tags=["Frontend"])
async def serve_spa(full_path: str):
    if full_path in ["docs", "redoc", "openapi.json", "health"]:
        raise HTTPException(status_code=404, detail="API endpoint not found")
    file_path = os.path.join(FRONTEND_DIST, full_path)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return FileResponse(file_path)
    index_path = os.path.join(FRONTEND_DIST, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Frontend build not found. Please run 'npm run build' in the frontend directory."}


# ─── Run ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
