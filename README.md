# LexAI — AI for Legal Assistance & Access

> **GenAI-powered legal document analysis built for accessibility, clarity, and actionability.**

LexAI uses **Google Gemini 2.0 Flash** to help non-lawyers understand, analyze, compare, and navigate legal documents — without replacing professional legal advice.

---

## Features

| Feature | Description |
|---|---|
| 📄 **Document Simplifier** | Converts legal jargon to plain English with key term definitions |
| 🛡️ **Risk Analysis** | Color-coded HIGH/MEDIUM/LOW risk clause detection |
| ⚖️ **Contract Comparison** | Side-by-side comparison with significance ratings |
| 💬 **Legal Q&A** | Grounded answers with source clause citations |
| 🧭 **Next Steps Advisor** | Prioritized action plan for any legal situation |
| 📋 **Summary & Checklist** | Executive summary + interactive actionable checklist |
| 👨‍⚖️ **Lawyer Prep** | Targeted questions and prep materials for attorney meetings |

---

## Tech Stack

- **Backend**: Python (FastAPI) + Google Gemini 2.0 Flash API
- **Frontend**: React 18 + Tailwind CSS + Vite
- **File Support**: PDF and TXT upload

---

## Quick Start

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate   # Windows
# source venv/bin/activate  # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Configure API key
copy .env.example .env
# Edit .env and add your Gemini API key:
# GEMINI_API_KEY=your_key_here

# Start the server
python main.py
# Server runs at http://localhost:8000
# API docs at http://localhost:8000/docs
```

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
# App runs at http://localhost:3000
```

### 3. Get a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a new API key
3. Paste it into `backend/.env`

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/simplify` | Simplify a legal document |
| `POST` | `/analyze-risks` | Analyze document for risks |
| `POST` | `/compare` | Compare two documents |
| `POST` | `/qna` | Answer questions from a document |
| `POST` | `/next-steps` | Get legal options and next steps |
| `POST` | `/summarize` | Generate summary and checklist |
| `POST` | `/lawyer-prep` | Generate lawyer prep materials |
| `POST` | `/upload` | Upload PDF/TXT and extract text |
| `GET` | `/docs` | Interactive Swagger UI |

All `/feature` endpoints also have a `/feature/file` variant for direct PDF/TXT upload.

---

## Project Structure

```
AI for legal Assistence/
├── backend/
│   ├── main.py           # FastAPI app with all endpoints
│   ├── prompts.py        # Engineered Gemini prompts
│   ├── gemini_client.py  # Gemini API wrapper
│   ├── models.py         # Pydantic request/response models
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── api.js         # API service
    │   ├── components/    # Shared UI components
    │   └── pages/        # Feature pages
    └── package.json
```

---

## Prompt Engineering

Each feature uses a carefully crafted prompt that:
- **Assigns a legal expert persona** to the model
- **Enforces strict JSON output** (no markdown, no preamble)
- **Sets explicit rules** for edge cases and quality thresholds
- **Uses `response_mime_type: "application/json"`** in generation config
- **Sets temperature=0.1** for deterministic, consistent outputs

---

## Legal Disclaimer

LexAI provides general legal information for educational purposes only. It does not provide legal advice and should not be used as a substitute for professional legal advice from a licensed attorney. Always consult a qualified legal professional for advice specific to your situation.
