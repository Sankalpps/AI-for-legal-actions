"""
Pydantic models for request/response validation.
"""
from pydantic import BaseModel
from typing import Optional, List


# ─── Request Models ────────────────────────────────────────────────────────────

class TextRequest(BaseModel):
    text: str
    context: Optional[str] = None


class CompareRequest(BaseModel):
    document_a: str
    document_b: str
    label_a: Optional[str] = "Document A"
    label_b: Optional[str] = "Document B"


class QnARequest(BaseModel):
    document: str
    question: str


class NextStepsRequest(BaseModel):
    situation: str
    jurisdiction: Optional[str] = "General (not jurisdiction-specific)"


class LawyerPrepRequest(BaseModel):
    situation: str
    document: Optional[str] = None


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
