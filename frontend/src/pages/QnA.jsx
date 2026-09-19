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
          <MessageSquare size={22} className="text-green-400" aria-hidden="true" />
          <h1 className="section-title">Legal Q&A</h1>
        </div>
        <p className="section-subtitle">
          Ask questions about your document and get grounded, cited answers.
        </p>
      </div>

      {/* Document Input */}
      <div className="card">
        <DocumentUpload
          id="qna-doc-input"
          label="Legal Document"
          value={document}
          onChange={setDocument}
          placeholder="Paste the legal document you want to ask questions about..."
          minRows={6}
        />
      </div>

      {/* Question Input */}
      <div className="card">
        <label htmlFor="qna-question-input" className="label font-semibold text-white">Your Question</label>
        <div className="flex gap-3 flex-col sm:flex-row">
          <textarea
            id="qna-question-input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKey}
            placeholder="e.g. What is the notice period for termination? Can the landlord enter without notice?"
            rows={3}
            aria-label="Question about the document"
            className="textarea-field flex-1 min-h-0 focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:outline-none"
          />
          <button
            onClick={handleSubmit}
            disabled={!document.trim() || !question.trim() || loading}
            aria-label="Send question"
            className="btn-primary self-end sm:self-auto px-5 py-3 focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:outline-none flex items-center justify-center gap-2"
          >
            {loading ? <span className="loading-spinner" aria-hidden="true" /> : <><Send size={16} aria-hidden="true" /> Send</>}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2">Tip: Press Ctrl+Enter to submit your question</p>
      </div>

      {loading && <LoadingCard message="Finding grounded answer in document..." />}
      {error && <ErrorCard message={error} />}

      {/* Q&A History */}
      {history.length > 0 && (
        <section className="space-y-4" role="region" aria-label="Q&A Answer History" aria-live="polite">
          {history.map((entry, idx) => (
            <div key={idx} className="space-y-3 animate-slide-up">
              {/* Question bubble */}
              <div className="flex justify-end">
                <div className="max-w-xl bg-primary-700 rounded-2xl rounded-br-sm px-4 py-3 shadow-md">
                  <p className="text-white text-sm font-medium">{entry.question}</p>
                </div>
              </div>

              {/* Answer card */}
              <div className="card">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Answer</h2>
                  <ConfidenceBadge level={entry.result.confidence} />
                </div>
                <p className="text-slate-200 text-sm leading-relaxed mb-4">{entry.result.answer}</p>

                {entry.result.source_clause && (
                  <div className="flex gap-2 p-3 bg-slate-800 rounded-xl border border-slate-700">
                    <Quote size={14} className="text-green-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <p className="text-xs font-semibold text-green-400 mb-1">Source Clause</p>
                      <blockquote className="text-xs text-slate-300 italic">{entry.result.source_clause}</blockquote>
                    </div>
                  </div>
                )}

                {entry.result.caveat && (
                  <p className="text-xs text-amber-300 mt-3 flex gap-1 items-center">
                    <span aria-hidden="true">⚠</span> {entry.result.caveat}
                  </p>
                )}

                <Disclaimer text={entry.result.disclaimer} />
              </div>
            </div>
          ))}
        </section>
      )}

      {!history.length && !loading && !error && (
        <EmptyState icon={MessageSquare} title="Ask a question about your document"
          description="Paste a legal document above, then type your question and press Send." />
      )}
    </div>
  );
}
