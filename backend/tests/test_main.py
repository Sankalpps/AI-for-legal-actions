"""
Integration and API endpoint tests for FastAPI main application.
Tests all endpoints, file upload text extraction, error responses, headers, and validation rules.
"""
import io
import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

from main import app, extract_text_from_file

client = TestClient(app)


# ─── Health Checks & Headers ───────────────────────────────────────────────────

class TestHealthAndMiddleware:
    def test_root_endpoint(self):
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "service" in data

    def test_health_endpoint(self):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "cache" in data
        assert "compression" in data

    def test_response_timing_header(self):
        response = client.get("/health")
        assert "x-response-time" in response.headers

    def test_gzip_compression_header(self):
        response = client.get("/health", headers={"Accept-Encoding": "gzip"})
        assert response.status_code == 200


# ─── File Upload Endpoint ──────────────────────────────────────────────────────

class TestFileUpload:
    def test_upload_txt_file(self):
        file_content = b"This is a sample legal text file for testing."
        response = client.post(
            "/upload",
            files={"file": ("test_doc.txt", io.BytesIO(file_content), "text/plain")}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["filename"] == "test_doc.txt"
        assert "sample legal text" in data["extracted_text"]
        assert data["char_count"] == len(file_content.decode("utf-8"))

    def test_upload_empty_file(self):
        response = client.post(
            "/upload",
            files={"file": ("empty.txt", io.BytesIO(b""), "text/plain")}
        )
        assert response.status_code == 400
        assert "empty" in response.json()["detail"].lower()

    def test_upload_unsupported_file_type(self):
        response = client.post(
            "/upload",
            files={"file": ("image.jpg", io.BytesIO(b"fake image data"), "image/jpeg")}
        )
        assert response.status_code == 400
        assert "unsupported file type" in response.json()["detail"].lower()


# ─── Feature Endpoints (Mocked AI Calls) ───────────────────────────────────────

MOCK_SIMPLIFY_RESP = {
    "plain_summary": "Simplified legal summary for test.",
    "key_terms": [{"term": "Indemnity", "definition": "Security against loss"}],
    "reading_level": "High School",
    "document_type": "Agreement",
    "disclaimer": "Informational only."
}

MOCK_RISK_RESP = {
    "document_type": "Contract",
    "overall_risk": "HIGH",
    "risk_clauses": [{
        "clause_text": "Unlimited liability",
        "risk_level": "HIGH",
        "risk_reason": "Excessive exposure",
        "page_reference": "Clause 4"
    }],
    "obligations": ["Pay within 30 days"],
    "inconsistencies": [],
    "disclaimer": "Informational only."
}

MOCK_COMPARE_RESP = {
    "summary": "Comparison summary text.",
    "differences": [{
        "category": "Termination",
        "document_a_text": "30 days notice",
        "document_b_text": "Immediate termination",
        "significance": "HIGH",
        "notes": "Doc B is riskier"
    }],
    "missing_in_a": [],
    "missing_in_b": [],
    "recommendation": "Use Document A",
    "disclaimer": "Informational only."
}

MOCK_QNA_RESP = {
    "answer": "The notice period is 30 days.",
    "source_clause": "Section 5(a)",
    "confidence": "HIGH",
    "caveat": "Applies to standard termination",
    "disclaimer": "Informational only."
}

MOCK_NEXT_STEPS_RESP = {
    "situation_summary": "Tenant security deposit dispute.",
    "legal_options": ["Send demand letter", "File in small claims court"],
    "next_steps": [{
        "step_number": 1,
        "action": "Send demand letter",
        "description": "Formally request deposit return",
        "urgency": "IMMEDIATE"
    }],
    "important_notes": ["Check statute of limitations"],
    "disclaimer": "Informational only."
}

MOCK_SUMMARY_RESP = {
    "document_type": "Lease Agreement",
    "executive_summary": "Comprehensive lease summary.",
    "key_parties": ["Landlord John", "Tenant Jane"],
    "key_dates": ["Start: Jan 1, 2025"],
    "key_obligations": ["Pay rent monthly"],
    "checklist": [{
        "item": "Sign lease agreement",
        "done": False,
        "priority": "HIGH"
    }],
    "disclaimer": "Informational only."
}

MOCK_LAWYER_PREP_RESP = {
    "case_summary": "Breach of contract dispute.",
    "documents_to_bring": ["Signed contract", "Email correspondence"],
    "questions": [{
        "category": "Strategy",
        "question": "What are my chances of winning?",
        "why_important": "Guides settlement decision"
    }],
    "red_flags": ["Missing signatures"],
    "disclaimer": "Informational only."
}


class TestFeatureEndpoints:
    @patch("main.call_gemini_async", new_callable=AsyncMock)
    def test_simplify_endpoint(self, mock_ai):
        mock_ai.return_value = MOCK_SIMPLIFY_RESP
        response = client.post("/simplify", json={"text": "This is a legal document text that needs simplification."})
        assert response.status_code == 200
        assert response.json()["plain_summary"] == "Simplified legal summary for test."

    @patch("main.call_gemini_async", new_callable=AsyncMock)
    def test_analyze_risks_endpoint(self, mock_ai):
        mock_ai.return_value = MOCK_RISK_RESP
        response = client.post("/analyze-risks", json={"text": "This is a contract text with risky clauses."})
        assert response.status_code == 200
        assert response.json()["overall_risk"] == "HIGH"

    @patch("main.call_gemini_async", new_callable=AsyncMock)
    def test_compare_endpoint(self, mock_ai):
        mock_ai.return_value = MOCK_COMPARE_RESP
        response = client.post("/compare", json={
            "document_a": "Document A text for comparison test.",
            "document_b": "Document B text for comparison test.",
            "label_a": "Doc A",
            "label_b": "Doc B"
        })
        assert response.status_code == 200
        assert response.json()["recommendation"] == "Use Document A"

    @patch("main.call_gemini_async", new_callable=AsyncMock)
    def test_qna_endpoint(self, mock_ai):
        mock_ai.return_value = MOCK_QNA_RESP
        response = client.post("/qna", json={
            "document": "Legal document text describing termination terms.",
            "question": "What is the notice period?"
        })
        assert response.status_code == 200
        assert response.json()["answer"] == "The notice period is 30 days."

    @patch("main.call_gemini_async", new_callable=AsyncMock)
    def test_next_steps_endpoint(self, mock_ai):
        mock_ai.return_value = MOCK_NEXT_STEPS_RESP
        response = client.post("/next-steps", json={
            "situation": "My landlord kept my deposit of $2000 without explanation.",
            "jurisdiction": "California"
        })
        assert response.status_code == 200
        assert len(response.json()["legal_options"]) == 2

    @patch("main.call_gemini_async", new_callable=AsyncMock)
    def test_summarize_endpoint(self, mock_ai):
        mock_ai.return_value = MOCK_SUMMARY_RESP
        response = client.post("/summarize", json={"text": "This is a complete lease document text for summary."})
        assert response.status_code == 200
        assert response.json()["document_type"] == "Lease Agreement"

    @patch("main.call_gemini_async", new_callable=AsyncMock)
    def test_lawyer_prep_endpoint(self, mock_ai):
        mock_ai.return_value = MOCK_LAWYER_PREP_RESP
        response = client.post("/lawyer-prep", json={
            "situation": "Contract dispute with a vendor over deliverables."
        })
        assert response.status_code == 200
        assert len(response.json()["questions"]) == 1


class TestValidationAndErrorHandling:
    def test_invalid_payload_validation_error(self):
        # Text too short (< 10 chars)
        response = client.post("/simplify", json={"text": "short"})
        assert response.status_code == 422

    def test_missing_required_field(self):
        response = client.post("/compare", json={"document_a": "Document A text valid"})
        assert response.status_code == 422
