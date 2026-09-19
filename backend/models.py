"""
Pydantic models for request/response validation.
Includes field-level validators for input size limits and data quality (efficiency).
"""
from pydantic import BaseModel, field_validator
from typing import Optional, List


# ─── Constants ─────────────────────────────────────────────────────────────────

MAX_DOCUMENT_LENGTH = 100_000    # ~100KB max document text (fail-fast before Gemini)
MAX_QUESTION_LENGTH = 2_000     # Max question/situation text length
MIN_TEXT_LENGTH = 10             # Minimum meaningful text length


# ─── Request Models ────────────────────────────────────────────────────────────

class TextRequest(BaseModel):
    """Request with a single text document."""
    model_config = {"str_strip_whitespace": True}

    text: str
    context: Optional[str] = None

    @field_validator("text")
    @classmethod
    def validate_text_length(cls, v: str) -> str:
        if len(v) < MIN_TEXT_LENGTH:
            raise ValueError(f"Text must be at least {MIN_TEXT_LENGTH} characters long.")
        if len(v) > MAX_DOCUMENT_LENGTH:
            raise ValueError(
                f"Text exceeds maximum length of {MAX_DOCUMENT_LENGTH:,} characters "
                f"({len(v):,} provided). Please shorten the document."
            )
        return v


class CompareRequest(BaseModel):
    """Request for comparing two documents."""
    model_config = {"str_strip_whitespace": True}

    document_a: str
    document_b: str
    label_a: Optional[str] = "Document A"
    label_b: Optional[str] = "Document B"

    @field_validator("document_a", "document_b")
    @classmethod
    def validate_document_length(cls, v: str) -> str:
        if len(v) < MIN_TEXT_LENGTH:
            raise ValueError(f"Document must be at least {MIN_TEXT_LENGTH} characters long.")
        if len(v) > MAX_DOCUMENT_LENGTH:
            raise ValueError(
                f"Document exceeds maximum length of {MAX_DOCUMENT_LENGTH:,} characters "
                f"({len(v):,} provided). Please shorten the document."
            )
        return v


class QnARequest(BaseModel):
    """Request for question-and-answer on a document."""
    model_config = {"str_strip_whitespace": True}

    document: str
    question: str

    @field_validator("document")
    @classmethod
    def validate_document(cls, v: str) -> str:
        if len(v) < MIN_TEXT_LENGTH:
            raise ValueError(f"Document must be at least {MIN_TEXT_LENGTH} characters long.")
        if len(v) > MAX_DOCUMENT_LENGTH:
            raise ValueError(f"Document exceeds maximum length of {MAX_DOCUMENT_LENGTH:,} characters.")
        return v

    @field_validator("question")
    @classmethod
    def validate_question(cls, v: str) -> str:
        if len(v) < 3:
            raise ValueError("Question must be at least 3 characters long.")
        if len(v) > MAX_QUESTION_LENGTH:
            raise ValueError(f"Question exceeds maximum length of {MAX_QUESTION_LENGTH:,} characters.")
        return v


class NextStepsRequest(BaseModel):
    """Request for legal options and next steps."""
    model_config = {"str_strip_whitespace": True}

    situation: str
    jurisdiction: Optional[str] = "General (not jurisdiction-specific)"

    @field_validator("situation")
    @classmethod
    def validate_situation(cls, v: str) -> str:
        if len(v) < MIN_TEXT_LENGTH:
            raise ValueError(f"Situation must be at least {MIN_TEXT_LENGTH} characters long.")
        if len(v) > MAX_QUESTION_LENGTH:
            raise ValueError(f"Situation exceeds maximum length of {MAX_QUESTION_LENGTH:,} characters.")
        return v


class LawyerPrepRequest(BaseModel):
    """Request for lawyer consultation preparation."""
    model_config = {"str_strip_whitespace": True}

    situation: str
    document: Optional[str] = None

    @field_validator("situation")
    @classmethod
    def validate_situation(cls, v: str) -> str:
        if len(v) < MIN_TEXT_LENGTH:
            raise ValueError(f"Situation must be at least {MIN_TEXT_LENGTH} characters long.")
        if len(v) > MAX_QUESTION_LENGTH:
            raise ValueError(f"Situation exceeds maximum length of {MAX_QUESTION_LENGTH:,} characters.")
        return v

    @field_validator("document")
    @classmethod
    def validate_document(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > MAX_DOCUMENT_LENGTH:
            raise ValueError(f"Document exceeds maximum length of {MAX_DOCUMENT_LENGTH:,} characters.")
        return v


# ─── Response Models ───────────────────────────────────────────────────────────

class SimplifyResponse(BaseModel):
    plain_summary: str
    key_terms: List[dict]          # [{term, definition}]
    reading_level: str
    document_type: str
    disclaimer: str


class RiskClause(BaseModel):
    clause_text: str
    risk_level: str                # HIGH | MEDIUM | LOW
    risk_reason: str
    page_reference: Optional[str]


class RiskResponse(BaseModel):
    document_type: str
    overall_risk: str              # HIGH | MEDIUM | LOW
    risk_clauses: List[RiskClause]
    obligations: List[str]
    inconsistencies: List[str]
    disclaimer: str


class DifferenceItem(BaseModel):
    category: str
    document_a_text: str
    document_b_text: str
    significance: str              # HIGH | MEDIUM | LOW
    notes: str


class CompareResponse(BaseModel):
    summary: str
    differences: List[DifferenceItem]
    missing_in_a: List[str]
    missing_in_b: List[str]
    recommendation: str
    disclaimer: str


class QnAResponse(BaseModel):
    answer: str
    source_clause: str
    confidence: str                # HIGH | MEDIUM | LOW
    caveat: str
    disclaimer: str


class NextStep(BaseModel):
    step_number: int
    action: str
    description: str
    urgency: str                   # IMMEDIATE | SHORT_TERM | LONG_TERM


class NextStepsResponse(BaseModel):
    situation_summary: str
    legal_options: List[str]
    next_steps: List[NextStep]
    important_notes: List[str]
    disclaimer: str


class ChecklistItem(BaseModel):
    item: str
    done: bool = False
    priority: str                  # HIGH | MEDIUM | LOW


class SummaryResponse(BaseModel):
    document_type: str
    executive_summary: str
    key_parties: List[str]
    key_dates: List[str]
    key_obligations: List[str]
    checklist: List[ChecklistItem]
    disclaimer: str


class LawyerQuestion(BaseModel):
    category: str
    question: str
    why_important: str


class LawyerPrepResponse(BaseModel):
    case_summary: str
    documents_to_bring: List[str]
    questions: List[LawyerQuestion]
    red_flags: List[str]
    disclaimer: str
