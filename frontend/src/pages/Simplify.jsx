import { useState } from "react";
import { FileText, BookOpen } from "lucide-react";
import DocumentUpload from "../components/DocumentUpload";
import { Disclaimer, LoadingCard, ErrorCard, SectionDivider, EmptyState } from "../components/ResultCard";
import { simplifyDocument } from "../api";

export default function Simplify() {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await simplifyDocument(text);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <FileText size={22} className="text-blue-400" />
          <h1 className="section-title">Simplify Document</h1>
        </div>
        <p className="section-subtitle">
          Upload or paste a legal document and get a plain-English explanation.
        </p>
      </div>

      {/* Input */}
      <div className="card">
        <DocumentUpload
          label="Legal Document"
          value={text}
          onChange={setText}
          placeholder="Paste your legal document, contract, agreement, or policy here..."
        />
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || loading}
            className="btn-primary"
          >
            {loading ? <><span className="loading-spinner" /> Simplifying...</> : <><BookOpen size={16} /> Simplify Document</>}
          </button>
        </div>
      </div>

      {/* Results */}
      {loading && <LoadingCard message="Simplifying your document..." />}
      {error && <ErrorCard message={error} onRetry={handleSubmit} />}

      {result && !loading && (
        <div className="space-y-4 animate-slide-up">
          {/* Overview */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Document Overview</h2>
              <div className="flex gap-2">
                <span className="px-2.5 py-1 bg-slate-800 text-slate-300 rounded-lg text-xs font-medium border border-slate-700">
                  {result.document_type}
                </span>
                <span className="px-2.5 py-1 bg-slate-800 text-slate-300 rounded-lg text-xs font-medium border border-slate-700">
                  {result.reading_level} Level
                </span>
              </div>
            </div>
            <div className="legal-prose">
              {result.plain_summary.split("\n").filter(Boolean).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>

          {/* Key Terms */}
          {result.key_terms?.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-bold text-white mb-4">Key Legal Terms Explained</h2>
              <div className="space-y-3">
                {result.key_terms.map((item, i) => (
                  <div key={i} className="flex gap-3 p-3 bg-slate-800/60 rounded-xl">
                    <div className="flex-shrink-0 w-1.5 bg-blue-500 rounded-full" />
                    <div>
                      <p className="text-sm font-semibold text-blue-300">{item.term}</p>
                      <p className="text-sm text-slate-400 mt-0.5">{item.definition}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Disclaimer text={result.disclaimer} />
        </div>
      )}

      {!result && !loading && !error && (
        <EmptyState
          icon={BookOpen}
          title="Results will appear here"
          description="Upload a document or paste legal text above and click 'Simplify Document'."
        />
      )}
    </div>
  );
}
