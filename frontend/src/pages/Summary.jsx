import { useState } from "react";
import { ClipboardList, CheckSquare, Square } from "lucide-react";
import DocumentUpload from "../components/DocumentUpload";
import { PriorityBadge } from "../components/RiskBadge";
import { Disclaimer, LoadingCard, ErrorCard, EmptyState } from "../components/ResultCard";
import { summarizeDocument } from "../api";

export default function Summary() {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [checkedItems, setCheckedItems] = useState({});

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setCheckedItems({});
    try {
      const data = await summarizeDocument(text);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleCheck = (i) =>
    setCheckedItems((prev) => ({ ...prev, [i]: !prev[i] }));

  const checkedCount = Object.values(checkedItems).filter(Boolean).length;
  const totalCount = result?.checklist?.length || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ClipboardList size={22} className="text-cyan-400" />
          <h1 className="section-title">Summary & Checklist</h1>
        </div>
        <p className="section-subtitle">
          Get a structured executive summary and actionable checklist from any legal document.
        </p>
      </div>

      <div className="card">
        <DocumentUpload label="Legal Document" value={text} onChange={setText}
          placeholder="Paste your legal document here..." />
        <div className="mt-4 flex justify-end">
          <button onClick={handleSubmit} disabled={!text.trim() || loading} className="btn-primary">
            {loading ? <><span className="loading-spinner" /> Generating...</> : <><ClipboardList size={16} /> Generate Summary</>}
          </button>
        </div>
      </div>

      {loading && <LoadingCard message="Generating summary and checklist..." />}
      {error && <ErrorCard message={error} onRetry={handleSubmit} />}

      {result && !loading && (
        <div className="space-y-4 animate-slide-up">
          {/* Executive Summary */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Executive Summary</h2>
              <span className="px-2.5 py-1 bg-slate-800 text-slate-300 rounded-lg text-xs font-medium border border-slate-700">
                {result.document_type}
              </span>
            </div>
            <div className="legal-prose">
              {result.executive_summary.split("\n").filter(Boolean).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>

          {/* Key Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {result.key_parties?.length > 0 && (
              <div className="card">
                <h3 className="text-sm font-semibold text-cyan-400 mb-3">👥 Key Parties</h3>
                <ul className="space-y-1.5">
                  {result.key_parties.map((p, i) => (
                    <li key={i} className="text-xs text-slate-300">{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.key_dates?.length > 0 && (
              <div className="card">
                <h3 className="text-sm font-semibold text-cyan-400 mb-3">📅 Key Dates</h3>
                <ul className="space-y-1.5">
                  {result.key_dates.map((d, i) => (
                    <li key={i} className="text-xs text-slate-300">{d}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.key_obligations?.length > 0 && (
              <div className="card">
                <h3 className="text-sm font-semibold text-cyan-400 mb-3">⚡ Obligations</h3>
                <ul className="space-y-1.5">
                  {result.key_obligations.map((o, i) => (
                    <li key={i} className="text-xs text-slate-300">{o}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Checklist */}
          {result.checklist?.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Action Checklist</h2>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-slate-400">{checkedCount}/{totalCount} done</div>
                  <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all duration-300"
                      style={{ width: `${totalCount ? (checkedCount / totalCount) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {result.checklist
                  .sort((a, b) => {
                    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
                    return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
                  })
                  .map((item, i) => (
                    <button
                      key={i}
                      onClick={() => toggleCheck(i)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800/60 transition-colors text-left group"
                    >
                      {checkedItems[i] ? (
                        <CheckSquare size={18} className="text-green-400 flex-shrink-0" />
                      ) : (
                        <Square size={18} className="text-slate-600 flex-shrink-0 group-hover:text-slate-400" />
                      )}
                      <span className={`flex-1 text-sm ${checkedItems[i] ? "line-through text-slate-600" : "text-slate-300"}`}>
                        {item.item}
                      </span>
                      <PriorityBadge level={item.priority} />
                    </button>
                  ))}
              </div>
            </div>
          )}

          <Disclaimer text={result.disclaimer} />
        </div>
      )}

      {!result && !loading && !error && (
        <EmptyState icon={ClipboardList} title="Summary and checklist will appear here"
          description="Upload or paste a document above and click 'Generate Summary'." />
      )}
    </div>
  );
}
