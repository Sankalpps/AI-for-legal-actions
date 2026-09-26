"""
FastAPI main application.
Provides all 7 legal assistance endpoints plus PDF/TXT file upload support.

Efficiency & cost controls: GZip, per-IP rate limiting (actually enforced), a daily cap on
real AI calls, response caching + in-flight de-duplication, token-lean prompts, local text
cleanup, and excerpt selection for long-document Q&A.
"""
import io
import os
import time
import logging
import re
from collections import deque
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse
from pydantic import ValidationError

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
    SYSTEM_PERSONA, DISCLAIMERS, MAX_TOKENS, QNA_EXCERPT_SCOPE,
    SIMPLIFY_PROMPT, RISK_PROMPT, COMPARE_PROMPT,
    QNA_PROMPT, NEXT_STEPS_PROMPT, SUMMARY_PROMPT, LAWYER_PREP_PROMPT,
)
from gemini_client import gemini_client, BudgetExceeded
from textutil import condense, select_relevant

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


# ─── Rate limiting (per client IP, AI endpoints only) ─────────────────────────
# Note: this replaces a slowapi Limiter that was configured but never attached as
# middleware or decorator, so it enforced nothing.

RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "20"))   # 0 disables
RATE_LIMITING_AVAILABLE = True


class RateGuard:
    """Sliding-window limiter: at most `limit` requests per `window` seconds per key."""

    def __init__(self, limit: int, window: float = 60.0, max_keys: int = 5000):
        self.limit = limit
        self.window = window
        self.max_keys = max_keys
        self._hits: dict = {}

    def check(self, key: str) -> None:
        if self.limit <= 0:
            return
        now = time.monotonic()
        hits = self._hits.setdefault(key, deque())
        while hits and now - hits[0] > self.window:
            hits.popleft()
        if len(hits) >= self.limit:
            retry_after = max(1, int(self.window - (now - hits[0])) + 1)
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please wait a moment before trying again.",
                headers={"Retry-After": str(retry_after)},
            )
        hits.append(now)
        if len(self._hits) > self.max_keys:  # bound memory: drop idle keys
            for k in [k for k, v in self._hits.items() if not v or now - v[-1] > self.window]:
                del self._hits[k]


rate_guard = RateGuard(RATE_LIMIT_PER_MINUTE)


def client_ip(request: Request) -> str:
    """Best-effort client IP (behind Render's proxy the real IP arrives in X-Forwarded-For)."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def rate_limit(request: Request) -> None:
    rate_guard.check(client_ip(request))


AI_LIMITED = [Depends(rate_limit)]


# ─── Middleware Stack (order matters) ──────────────────────────────────────────

# 1. GZip compression — compress responses > 500 bytes (~60-80% size reduction)
app.add_middleware(GZipMiddleware, minimum_size=500)

# 2. CORS — set ALLOWED_ORIGINS (comma-separated) in production to your frontend URL(s).
#    Credentials are not used by this app, so they stay off (also required for a "*" origin).
_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins or ["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


# 3. Request timing + security headers
@app.middleware("http")
async def add_request_timing(request: Request, call_next):
    """Log request duration, add X-Response-Time and baseline security headers."""
    start_time = time.time()
    response = await call_next(request)
    duration_ms = round((time.time() - start_time) * 1000)
    response.headers["X-Response-Time"] = f"{duration_ms}ms"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"

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
    Validates file size before processing. Output is whitespace-condensed so that
    later AI calls carry fewer tokens.
    """
    try:
        content = await file.read()

        # Validate file size (fail-fast)
        if len(content) > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File too large ({len(content):,} bytes). Maximum size is {MAX_FILE_SIZE_BYTES // (1024*1024)} MB.",
            )

        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        name = (file.filename or "").lower()

        if name.endswith(".pdf"):
            if PyPDF2 is None:
                raise HTTPException(status_code=400, detail="PDF support not installed. Please install PyPDF2.")
            if not content.lstrip().startswith(b"%PDF-"):
                raise HTTPException(status_code=400, detail="This file is not a valid PDF.")
            try:
                reader = PyPDF2.PdfReader(io.BytesIO(content))
                text = "\n".join(page.extract_text() or "" for page in reader.pages)
            except Exception as exc:
                logger.warning(f"PDF read failed: {exc}")
                raise HTTPException(status_code=400, detail="Could not read this PDF. It may be corrupted or password-protected.")
            return condense(text)

        if name.endswith(".txt"):
            return condense(content.decode("utf-8", errors="replace"))

        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.filename}. Only PDF and TXT files are supported.",
        )
    finally:
        # Ensure file handle is properly closed
        await file.close()


async def call_gemini_async(prompt: str, max_tokens: Optional[int] = None) -> dict:
    """Call the AI provider (cached, de-duplicated, budget-capped) and map failures to HTTP errors.

    Provider error text is logged server-side only, never returned to the client.
    """
    try:
        return await gemini_client.generate_async(prompt, max_tokens=max_tokens)
    except BudgetExceeded as e:
        logger.warning(str(e))
        raise HTTPException(
            status_code=429,
            detail="The daily AI usage limit has been reached. Cached results still work; please try again tomorrow.",
        )
    except ValueError as e:
        logger.warning(f"Unparseable model response: {e}")
        raise HTTPException(status_code=422, detail="The AI returned an unreadable response. Please try again.")
    except RuntimeError as e:
        msg = str(e)
        if "429" in msg or "quota" in msg.lower() or "resourceexhausted" in msg.lower():
            retry_match = re.search(r"retry(?: in|_delay.*?seconds?)[^0-9]*(\d+)", msg, re.IGNORECASE)
            retry_after = int(retry_match.group(1)) if retry_match else 60
            is_daily_quota = "PerDay" in msg or "per day" in msg.lower() or "free_tier" in msg.lower()
            detail = (
                "The Gemini daily quota has been exhausted. Add billing or wait for the quota to reset."
                if is_daily_quota
                else "The AI service rate limit was reached. Please wait before trying again."
            )
            raise HTTPException(
                status_code=429,
                detail=detail,
                headers={"Retry-After": str(retry_after)},
            )
        logger.error(f"AI service error: {msg}")
        raise HTTPException(status_code=503, detail="The AI service is temporarily unavailable. Please try again shortly.")


RESPONSE_MODELS = {
    "simplify": SimplifyResponse, "risk": RiskResponse, "compare": CompareResponse,
    "qna": QnAResponse, "next_steps": NextStepsResponse, "summary": SummaryResponse,
    "lawyer_prep": LawyerPrepResponse,
}


async def run_feature(feature: str, prompt: str) -> dict:
    """Run one AI feature: apply its token ceiling, then attach the fixed disclaimer.

    The disclaimer is a constant sentence, so the server adds it instead of paying the
    model to write it on every call.
    """
    result = await call_gemini_async(prompt, max_tokens=MAX_TOKENS[feature])
    result = dict(result)  # never mutate the cached object
    result["disclaimer"] = DISCLAIMERS[feature]
    try:
        RESPONSE_MODELS[feature].model_validate(result)
    except ValidationError as exc:
        # Don't let an incomplete AI answer sit in the cache: a retry must make a fresh call.
        gemini_client.forget(prompt)
        logger.warning(f"{feature}: AI response failed validation: {exc.error_count()} error(s)")
        raise HTTPException(status_code=422, detail="The AI returned an incomplete response. Please try again.")
    return result


# ─── Health Check ──────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "service": "LexAI Legal Assistance API", "version": "1.0.0"}


@app.get("/health", tags=["Health"])
def health():
    return {
        "status": "healthy",
        "ai_provider": gemini_client.provider,
        "ai_model": gemini_client.model_name,
        "cache": gemini_client.cache_stats,
        "daily_ai_budget": gemini_client.budget_stats,
        "rate_limiting": RATE_LIMITING_AVAILABLE,
        "rate_limit_per_minute": RATE_LIMIT_PER_MINUTE,
        "compression": "gzip",
    }


# ─── File Upload Endpoint ──────────────────────────────────────────────────────

@app.post("/upload", tags=["Utilities"], dependencies=AI_LIMITED)
async def upload_file(file: UploadFile = File(...)):
    """Upload a PDF or TXT file and extract its text content (no AI call, no credits)."""
    text = await extract_text_from_file(file)
    if not text:
        raise HTTPException(status_code=400, detail="Could not extract text from the uploaded file.")
    return {"filename": file.filename, "extracted_text": text, "char_count": len(text)}


# ─── 1. Document Simplifier ────────────────────────────────────────────────────

@app.post("/simplify", response_model=SimplifyResponse, tags=["Features"], dependencies=AI_LIMITED)
async def simplify_document(request: TextRequest):
    """Simplify a complex legal document into plain English."""
    prompt = SIMPLIFY_PROMPT.format(system=SYSTEM_PERSONA, document=condense(request.text))
    return await run_feature("simplify", prompt)


@app.post("/simplify/file", response_model=SimplifyResponse, tags=["Features"], dependencies=AI_LIMITED)
async def simplify_document_file(file: UploadFile = File(...)):
    """Simplify a legal document uploaded as PDF or TXT."""
    text = await extract_text_from_file(file)
    prompt = SIMPLIFY_PROMPT.format(system=SYSTEM_PERSONA, document=text)
    return await run_feature("simplify", prompt)


# ─── 2. Risk & Clause Highlighter ─────────────────────────────────────────────

@app.post("/analyze-risks", response_model=RiskResponse, tags=["Features"], dependencies=AI_LIMITED)
async def analyze_risks(request: TextRequest):
    """Analyze a legal document for risky clauses, obligations, and inconsistencies."""
    prompt = RISK_PROMPT.format(system=SYSTEM_PERSONA, document=condense(request.text))
    return await run_feature("risk", prompt)


@app.post("/analyze-risks/file", response_model=RiskResponse, tags=["Features"], dependencies=AI_LIMITED)
async def analyze_risks_file(file: UploadFile = File(...)):
    """Analyze risks in a legal document uploaded as PDF or TXT."""
    text = await extract_text_from_file(file)
    prompt = RISK_PROMPT.format(system=SYSTEM_PERSONA, document=text)
    return await run_feature("risk", prompt)


# ─── 3. Contract Comparison ────────────────────────────────────────────────────

@app.post("/compare", response_model=CompareResponse, tags=["Features"], dependencies=AI_LIMITED)
async def compare_documents(request: CompareRequest):
    """Compare two legal documents and identify all differences."""
    prompt = COMPARE_PROMPT.format(
        system=SYSTEM_PERSONA,
        label_a=condense(request.label_a or "Document A"),
        label_b=condense(request.label_b or "Document B"),
        document_a=condense(request.document_a),
        document_b=condense(request.document_b),
    )
    return await run_feature("compare", prompt)


@app.post("/compare/files", response_model=CompareResponse, tags=["Features"], dependencies=AI_LIMITED)
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
        label_a=condense(label_a),
        label_b=condense(label_b),
        document_a=text_a,
        document_b=text_b,
    )
    return await run_feature("compare", prompt)


# ─── 4. Legal Q&A ─────────────────────────────────────────────────────────────

@app.post("/qna", response_model=QnAResponse, tags=["Features"], dependencies=AI_LIMITED)
async def legal_qna(request: QnARequest):
    """Answer a question based on the provided legal document.

    Short documents are sent whole. For long ones only the passages relevant to the
    question are sent (chosen locally, for free), which is the biggest saving here
    because Q&A re-sends the document with every question.
    """
    document = condense(request.document)
    excerpt = select_relevant(document, request.question)
    prompt = QNA_PROMPT.format(
        system=SYSTEM_PERSONA,
        document=excerpt,
        question=condense(request.question),
        scope=QNA_EXCERPT_SCOPE if len(excerpt) < len(document) else "",
    )
    return await run_feature("qna", prompt)


# ─── 5. Options & Next Steps ──────────────────────────────────────────────────

@app.post("/next-steps", response_model=NextStepsResponse, tags=["Features"], dependencies=AI_LIMITED)
async def get_next_steps(request: NextStepsRequest):
    """Get legal options and next steps based on a described situation."""
    prompt = NEXT_STEPS_PROMPT.format(
        system=SYSTEM_PERSONA,
        situation=condense(request.situation),
        jurisdiction=condense(request.jurisdiction or "General (not jurisdiction-specific)"),
    )
    return await run_feature("next_steps", prompt)


# ─── 6. Summary & Checklist Generator ─────────────────────────────────────────

@app.post("/summarize", response_model=SummaryResponse, tags=["Features"], dependencies=AI_LIMITED)
async def summarize_document(request: TextRequest):
    """Generate an executive summary and actionable checklist from a legal document."""
    prompt = SUMMARY_PROMPT.format(system=SYSTEM_PERSONA, document=condense(request.text))
    return await run_feature("summary", prompt)


@app.post("/summarize/file", response_model=SummaryResponse, tags=["Features"], dependencies=AI_LIMITED)
async def summarize_document_file(file: UploadFile = File(...)):
    """Summarize a legal document uploaded as PDF or TXT."""
    text = await extract_text_from_file(file)
    prompt = SUMMARY_PROMPT.format(system=SYSTEM_PERSONA, document=text)
    return await run_feature("summary", prompt)


# ─── 7. Lawyer Prep Assistant ─────────────────────────────────────────────────

@app.post("/lawyer-prep", response_model=LawyerPrepResponse, tags=["Features"], dependencies=AI_LIMITED)
async def lawyer_prep(request: LawyerPrepRequest):
    """Generate targeted questions and prep materials for a lawyer consultation."""
    prompt = LAWYER_PREP_PROMPT.format(
        system=SYSTEM_PERSONA,
        situation=condense(request.situation),
        document=condense(request.document) if request.document else "No document provided.",
    )
    return await run_feature("lawyer_prep", prompt)


@app.post("/lawyer-prep/file", response_model=LawyerPrepResponse, tags=["Features"], dependencies=AI_LIMITED)
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
        situation=condense(situation),
        document=document_text,
    )
    return await run_feature("lawyer_prep", prompt)


# ─── Static Frontend & SPA Fallback ───────────────────────────────────────────

FRONTEND_DIST = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
ASSETS_DIR = os.path.join(FRONTEND_DIST, "assets")

if os.path.exists(ASSETS_DIR):
    from fastapi.staticfiles import StaticFiles
    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")


def _safe_static_path(full_path: str) -> Optional[str]:
    """Resolve `full_path` inside FRONTEND_DIST, or return None if it escapes it.

    Guards against path traversal (e.g. /..%2f..%2fbackend%2f.env), which the previous
    os.path.join() lookup allowed.
    """
    try:
        root = os.path.realpath(FRONTEND_DIST)
        candidate = os.path.realpath(os.path.join(root, full_path))
        if os.path.commonpath([root, candidate]) != root:
            return None
        return candidate if os.path.isfile(candidate) else None
    except (ValueError, OSError):  # null bytes, other-drive paths on Windows, etc.
        return None


@app.get("/{full_path:path}", tags=["Frontend"])
async def serve_spa(full_path: str):
    if full_path in ["docs", "redoc", "openapi.json", "health"]:
        raise HTTPException(status_code=404, detail="API endpoint not found")
    safe = _safe_static_path(full_path)
    if safe:
        return FileResponse(safe)
    index_path = os.path.join(FRONTEND_DIST, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Frontend build not found. Please run 'npm run build' in the frontend directory."}


# ─── Run ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    # reload is a dev convenience; set RELOAD=0 in production.
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")),
                reload=os.getenv("RELOAD", "1") == "1")
