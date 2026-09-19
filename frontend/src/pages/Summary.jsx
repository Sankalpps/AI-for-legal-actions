import { useState } from "react";
import { ClipboardList, CheckSquare, Calendar, Users, ListCheck } from "lucide-react";
import DocumentUpload from "../components/DocumentUpload";
import { PriorityBadge } from "../components/RiskBadge";
import { Disclaimer, LoadingCard, ErrorCard, EmptyState } from "../components/ResultCard";
import { summarizeDocument } from "../api";

export default function Summary() {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [checklistState, setChecklistState] = useState([]);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await summarizeDocument(text);
      setResult(data);
      setChecklistState(data.checklist || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleChecklist = (index) => {
    setChecklistState((prev) =>
      prev.map((item, i) => (i === index ? { ...item, done: !item.done } : item))
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ClipboardList size={22} className="text-cyan-400" aria-hidden="true" />
          <h1 className="section-title">Summary & Checklist</h1>
        </div>
        <p className="section-subtitle">
          Get an executive summary and interactive action checklist from any document.
        </p>
      </div>

      <div className="card">
        <DocumentUpload
          id="summary-doc-input"
          label="Legal Document"
          value={text}
          onChange={setText}
          placeholder="Paste your legal document, contract, or policy here..."
        />
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || loading}
            aria-label="Generate executive summary and checklist"
            className="btn-primary focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:outline-none"
          >
            {loading ? <><span className="loading-spinner" aria-hidden="true" /> Summarizing...</> : <><ListCheck size={16} aria-hidden="true" /> Generate Summary</>}
          </button>
        </div>
      </div>

      {loading && <LoadingCard message="Generating executive summary and checklist..." />}
      {error && <ErrorCard message={error} onRetry={handleSubmit} />}

      {result && !loading && (
        <section className="space-y-4 animate-slide-up" role="region" aria-label="Executive Summary and Checklist Results">
          {/* Executive Summary */}
          <div className="card">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-lg font-bold text-white">Executive Summary</h2>
              <span className="px-2.5 py-1 bg-slate-800 text-slate-200 rounded-lg text-xs font-medium border border-slate-700">
                {result.document_type}
              </span>
            </div>
            <div className="legal-prose text-slate-200 leading-relaxed space-y-3">
              {result.executive_summary.split("\n").filter(Boolean).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>

          {/* Key Parties & Key Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.key_parties?.length > 0 && (
              <div className="card">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Users size={16} className="text-cyan-400" aria-hidden="true" /> Key Parties
                </h3>
                <ul className="space-y-1.5">
                  {result.key_parties.map((party, i) => (
                    <li key={i} className="text-sm text-slate-300 flex gap-2">
                      <span className="text-cyan-400 flex-shrink-0" aria-hidden="true">•</span>{party}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.key_dates?.length > 0 && (
              <div className="card">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Calendar size={16} className="text-amber-400" aria-hidden="true" /> Key Dates & Deadlines
                </h3>
                <ul className="space-y-1.5">
                  {result.key_dates.map((date, i) => (
                    <li key={i} className="text-sm text-slate-300 flex gap-2">
                      <span className="text-amber-400 flex-shrink-0" aria-hidden="true">•</span>{date}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Action Checklist */}
          {checklistState?.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <CheckSquare size={18} className="text-green-400" aria-hidden="true" /> Action Checklist
              </h2>
              <div className="space-y-2.5" role="group" aria-label="Action Checklist Items">
                {checklistState.map((item, i) => (
                  <div
                    key={i}
                    onClick={() => toggleChecklist(i)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                      item.done
                        ? "bg-slate-900/50 border-slate-800 opacity-60"
                        : "bg-slate-800/60 border-slate-700 hover:border-slate-600"
                    }`}
                  >
                    <label className="flex items-center gap-3 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => toggleChecklist(i)}
                        aria-label={`Checklist item: ${item.item}`}
                        className="rounded border-slate-700 bg-slate-900 text-primary-600 focus:ring-primary-500 w-4 h-4 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary-400"
                      />
                      <span className={`text-sm ${item.done ? "line-through text-slate-400" : "text-slate-200"}`}>
                        {item.item}
                      </span>
                    </label>
                    <PriorityBadge level={item.priority} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <Disclaimer text={result.disclaimer} />
        </section>
      )}

      {!result && !loading && !error && (
        <EmptyState icon={ClipboardList} title="Summary and checklist will appear here"
          description="Upload or paste a document above and click 'Generate Summary'." />
      )}
    </div>
  );
}
