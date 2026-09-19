"""
Unit tests for Pydantic request/response models and input validators.
"""
import pytest
from pydantic import ValidationError

from models import (
    TextRequest, CompareRequest, QnARequest, NextStepsRequest, LawyerPrepRequest,
    SimplifyResponse, RiskResponse, CompareResponse, QnAResponse,
    NextStepsResponse, SummaryResponse, LawyerPrepResponse,
    MAX_DOCUMENT_LENGTH, MAX_QUESTION_LENGTH, MIN_TEXT_LENGTH
)


class TestTextRequest:
    def test_valid_text(self):
        req = TextRequest(text="   This is a valid legal document text sample.   ")
        assert req.text == "This is a valid legal document text sample."

    def test_text_too_short(self):
        with pytest.raises(ValidationError) as exc:
            TextRequest(text="Short")
        assert f"at least {MIN_TEXT_LENGTH} characters" in str(exc.value)

    def test_text_too_long(self):
        long_text = "a" * (MAX_DOCUMENT_LENGTH + 1)
        with pytest.raises(ValidationError) as exc:
            TextRequest(text=long_text)
        assert f"exceeds maximum length of {MAX_DOCUMENT_LENGTH:,}" in str(exc.value)


class TestCompareRequest:
    def test_valid_compare(self):
        req = CompareRequest(
            document_a="Document A valid text content.",
            document_b="Document B valid text content.",
            label_a="Contract A",
            label_b="Contract B"
        )
        assert req.label_a == "Contract A"
        assert req.label_b == "Contract B"

    def test_compare_too_short(self):
        with pytest.raises(ValidationError):
            CompareRequest(document_a="Short", document_b="Document B valid text content.")

    def test_compare_too_long(self):
        long_text = "x" * (MAX_DOCUMENT_LENGTH + 5)
        with pytest.raises(ValidationError):
            CompareRequest(document_a=long_text, document_b="Document B valid text content.")


class TestQnARequest:
    def test_valid_qna(self):
        req = QnARequest(document="Valid document text content here.", question="What is the notice period?")
        assert req.question == "What is the notice period?"

    def test_question_too_short(self):
        with pytest.raises(ValidationError) as exc:
            QnARequest(document="Valid document text content here.", question="Hi")
        assert "at least 3 characters" in str(exc.value)

    def test_question_too_long(self):
        long_question = "q" * (MAX_QUESTION_LENGTH + 10)
        with pytest.raises(ValidationError):
            QnARequest(document="Valid document text content here.", question=long_question)


class TestNextStepsRequest:
    def test_valid_next_steps(self):
        req = NextStepsRequest(situation="My landlord didn't return my deposit.", jurisdiction="California")
        assert req.jurisdiction == "California"

    def test_situation_too_short(self):
        with pytest.raises(ValidationError):
            NextStepsRequest(situation="Tiny")


class TestLawyerPrepRequest:
    def test_valid_lawyer_prep(self):
        req = LawyerPrepRequest(situation="I got sued for copyright infringement.", document="Optional doc text here.")
        assert req.document == "Optional doc text here."

    def test_lawyer_prep_no_doc(self):
        req = LawyerPrepRequest(situation="I got sued for copyright infringement.")
        assert req.document is None


class TestResponseModels:
    def test_simplify_response_schema(self):
        resp = SimplifyResponse(
            plain_summary="Simple overview text.",
            key_terms=[{"term": "Term", "definition": "Def"}],
            reading_level="High School",
            document_type="Contract",
            disclaimer="Test disclaimer"
        )
        assert resp.reading_level == "High School"
        assert len(resp.key_terms) == 1

    def test_risk_response_schema(self):
        resp = RiskResponse(
            document_type="Agreement",
            overall_risk="HIGH",
            risk_clauses=[{
                "clause_text": "Clause 1",
                "risk_level": "HIGH",
                "risk_reason": "One-sided clause",
                "page_reference": "Section 2"
            }],
            obligations=["Pay rent on 1st"],
            inconsistencies=[],
            disclaimer="Test disclaimer"
        )
        assert resp.overall_risk == "HIGH"
        assert len(resp.risk_clauses) == 1
