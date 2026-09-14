import { useState } from "react";
import { MessageSquare, Send, Quote } from "lucide-react";
import DocumentUpload from "../components/DocumentUpload";
import { ConfidenceBadge } from "../components/RiskBadge";
import { Disclaimer, LoadingCard, ErrorCard, EmptyState } from "../components/ResultCard";
import { legalQnA } from "../api";

export default function QnA() {
  const [document, setDocument] = useState("");
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);

  const handleSubmit = async () => {
    if (!document.trim() || !question.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const data = await legalQnA(document, question);
      const entry = { question, result: data };
      setHistory((prev) => [entry, ...prev]);
      setResult(data);
      setQuestion("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSubmit();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare size={22} className="text-green-400" />
          <h1 className="section-title">Legal Q&A</h1>
        </div>
        <p className="section-subtitle">
          Ask questions about your document and get grounded, cited answers.
        </p>
      </div>

      {/* Document Input */}
      <div className="card">
        <DocumentUpload label="Legal Document" value={document} onChange={setDocument}
          placeholder="Paste the legal document you want to ask questions about..." minRows={6} />
      </div>

      {/* Question Input */}
      <div className="card">
        <label className="label">Your Question</label>
        <div className="flex gap-3">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKey}
            placeholder="e.g. What is the notice period for termination? Can the landlord enter without notice?"
            rows={3}
            className="textarea-field flex-1 min-h-0"
          />
          <button
            onClick={handleSubmit}
            disabled={!document.trim() || !question.trim() || loading}
            className="btn-primary self-end px-4"
          >
            {loading ? <span className="loading-spinner" /> : <Send size={16} />}
          </button>
        </div>
        <p className="text-xs text-slate-600 mt-1">Tip: Press Ctrl+Enter to submit</p>
      </div>

      {loading && <LoadingCard message="Finding answer in document..." />}
      {error && <ErrorCard message={error} />}

      {/* Q&A History */}
      {history.length > 0 && (
        <div className="space-y-4">
          {history.map((entry, idx) => (
            <div key={idx} className="space-y-3 animate-slide-up">
              {/* Question bubble */}
              <div className="flex justify-end">
                <div className="max-w-xl bg-primary-700 rounded-2xl rounded-br-sm px-4 py-3">
                  <p className="text-white text-sm">{entry.question}</p>
                </div>
              </div>

              {/* Answer card */}
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Answer</p>
                  <ConfidenceBadge level={entry.result.confidence} />
                </div>
                <p className="text-slate-200 text-sm leading-relaxed mb-4">{entry.result.answer}</p>

                {entry.result.source_clause && (
                  <div className="flex gap-2 p-3 bg-slate-800 rounded-xl border border-slate-700">
                    <Quote size={14} className="text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-green-400 mb-1">Source Clause</p>
                      <p className="text-xs text-slate-400 italic">{entry.result.source_clause}</p>
                    </div>
                  </div>
                )}

                {entry.result.caveat && (
                  <p className="text-xs text-amber-400/70 mt-3 flex gap-1">
                    <span>⚠</span> {entry.result.caveat}
                  </p>
                )}

                <Disclaimer text={entry.result.disclaimer} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!history.length && !loading && !error && (
        <EmptyState icon={MessageSquare} title="Ask a question about your document"
          description="Paste a legal document above, then type your question and press Send." />
      )}
    </div>
  );
}
