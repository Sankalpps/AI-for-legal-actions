import { useState } from "react";
import { AlertTriangle, ShieldAlert, List, GitBranch } from "lucide-react";
import DocumentUpload from "../components/DocumentUpload";
import RiskBadge from "../components/RiskBadge";
import { Disclaimer, LoadingCard, ErrorCard, EmptyState } from "../components/ResultCard";
import { analyzeRisks } from "../api";

export default function RiskAnalysis() {
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
      const data = await analyzeRisks(text);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle size={22} className="text-red-400" />
          <h1 className="section-title">Risk Analysis</h1>
        </div>
        <p className="section-subtitle">
          Identify risky clauses, obligations, and inconsistencies in your legal document.
        </p>
      </div>

      <div className="card">
        <DocumentUpload label="Legal Document" value={text} onChange={setText}
          placeholder="Paste your contract, lease, terms of service, or any legal document..." />
        <div className="mt-4 flex justify-end">
          <button onClick={handleSubmit} disabled={!text.trim() || loading} className="btn-primary">
            {loading ? <><span className="loading-spinner" /> Analyzing...</> : <><ShieldAlert size={16} /> Analyze Risks</>}
          </button>
        </div>
      </div>

      {loading && <LoadingCard message="Analyzing document for risks..." />}
      {error && <ErrorCard message={error} onRetry={handleSubmit} />}

      {result && !loading && (
        <div className="space-y-4 animate-slide-up">
          {/* Overall Risk */}
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white mb-0.5">Overall Risk Assessment</h2>
                <p className="text-sm text-slate-400">{result.document_type}</p>
              </div>
              <div className="text-right">
                <RiskBadge level={result.overall_risk} />
              </div>
            </div>
          </div>

          {/* Risk Clauses */}
          {result.risk_clauses?.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-400" />
                Risk Clauses ({result.risk_clauses.length})
              </h2>
              <div className="space-y-3">
                {result.risk_clauses
                  .sort((a, b) => {
                    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
                    return (order[a.risk_level] ?? 3) - (order[b.risk_level] ?? 3);
                  })
                  .map((clause, i) => (
                    <div
                      key={i}
                      className={`p-4 rounded-xl border ${
                        clause.risk_level === "HIGH"
                          ? "bg-red-900/10 border-red-800/40"
                          : clause.risk_level === "MEDIUM"
                          ? "bg-amber-900/10 border-amber-800/40"
                          : "bg-slate-800/60 border-slate-700"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <p className="text-sm font-medium text-slate-200 leading-relaxed flex-1">
                          "{clause.clause_text}"
                        </p>
                        <RiskBadge level={clause.risk_level} />
                      </div>
                      <p className="text-sm text-slate-400 mt-2">{clause.risk_reason}</p>
                      {clause.page_reference && (
                        <p className="text-xs text-slate-600 mt-1">📍 {clause.page_reference}</p>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Obligations */}
          {result.obligations?.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <List size={18} className="text-amber-400" />
                Your Obligations
              </h2>
              <ul className="space-y-2">
                {result.obligations.map((obligation, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-slate-300">
                    <span className="text-amber-400 mt-0.5 flex-shrink-0">▸</span>
                    {obligation}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Inconsistencies */}
          {result.inconsistencies?.length > 0 && (
            <div className="card border-purple-800/40 bg-purple-900/10">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <GitBranch size={18} className="text-purple-400" />
                Inconsistencies Found
              </h2>
              <ul className="space-y-2">
                {result.inconsistencies.map((item, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-slate-300">
                    <span className="text-purple-400 mt-0.5 flex-shrink-0">⚠</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Disclaimer text={result.disclaimer} />
        </div>
      )}

      {!result && !loading && !error && (
        <EmptyState icon={ShieldAlert} title="Risk analysis will appear here"
          description="Upload or paste a legal document above to identify potential risks." />
      )}
    </div>
  );
}
