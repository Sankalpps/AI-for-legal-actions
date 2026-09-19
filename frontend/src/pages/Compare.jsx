import { useState } from "react";
import { GitCompare, ArrowLeftRight } from "lucide-react";
import DocumentUpload from "../components/DocumentUpload";
import RiskBadge from "../components/RiskBadge";
import { Disclaimer, LoadingCard, ErrorCard, EmptyState } from "../components/ResultCard";
import { compareDocuments } from "../api";

export default function Compare() {
  const [docA, setDocA] = useState("");
  const [docB, setDocB] = useState("");
  const [labelA, setLabelA] = useState("Document A");
  const [labelB, setLabelB] = useState("Document B");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!docA.trim() || !docB.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await compareDocuments(docA, docB, labelA, labelB);
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
          <GitCompare size={22} className="text-purple-400" aria-hidden="true" />
          <h1 className="section-title">Compare Contracts</h1>
        </div>
        <p className="section-subtitle">
          Upload or paste two documents to compare differences, conflicts, and missing clauses.
        </p>
      </div>

      {/* Document inputs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <label htmlFor="label-doc-a" className="label text-white font-semibold">Document A Name</label>
          <input
            id="label-doc-a"
            value={labelA}
            onChange={(e) => setLabelA(e.target.value)}
            className="input-field mb-3 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:outline-none"
            placeholder="Document A label..."
            aria-label="Label for Document A"
          />
          <DocumentUpload
            id="compare-doc-a-text"
            label={labelA}
            value={docA}
            onChange={setDocA}
            placeholder="Paste Document A here..."
            minRows={8}
          />
        </div>
        <div className="card">
          <label htmlFor="label-doc-b" className="label text-white font-semibold">Document B Name</label>
          <input
            id="label-doc-b"
            value={labelB}
            onChange={(e) => setLabelB(e.target.value)}
            className="input-field mb-3 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:outline-none"
            placeholder="Document B label..."
            aria-label="Label for Document B"
          />
          <DocumentUpload
            id="compare-doc-b-text"
            label={labelB}
            value={docB}
            onChange={setDocB}
            placeholder="Paste Document B here..."
            minRows={8}
          />
        </div>
      </div>

      <div className="flex justify-center">
        <button
          onClick={handleSubmit}
          disabled={!docA.trim() || !docB.trim() || loading}
          aria-label="Compare the two documents"
          className="btn-primary focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:outline-none"
        >
          {loading
            ? <><span className="loading-spinner" aria-hidden="true" /> Comparing...</>
            : <><ArrowLeftRight size={16} aria-hidden="true" /> Compare Documents</>}
        </button>
      </div>

      {loading && <LoadingCard message="Comparing both legal documents side by side..." />}
      {error && <ErrorCard message={error} onRetry={handleSubmit} />}

      {result && !loading && (
        <section className="space-y-4 animate-slide-up" role="region" aria-label="Comparison Results">
          {/* Summary */}
          <div className="card">
            <h2 className="text-lg font-bold text-white mb-3">Comparison Summary</h2>
            <p className="text-slate-200 leading-relaxed text-sm">{result.summary}</p>
          </div>

          {/* Differences table */}
          {result.differences?.length > 0 && (
            <div className="card overflow-hidden p-0">
              <div className="px-6 py-4 border-b border-slate-800">
                <h2 className="text-lg font-bold text-white">
                  Key Differences ({result.differences.length})
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" aria-label="Document Differences Table">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/50">
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wide">Category</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wide">{labelA}</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wide">{labelB}</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wide">Significance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {result.differences
                      .sort((a, b) => {
                        const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
                        return (order[a.significance] ?? 3) - (order[b.significance] ?? 3);
                      })
                      .map((diff, i) => (
                        <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-200 whitespace-nowrap">{diff.category}</td>
                          <td className="px-4 py-3 text-slate-300 max-w-xs">{diff.document_a_text}</td>
                          <td className="px-4 py-3 text-slate-300 max-w-xs">{diff.document_b_text}</td>
                          <td className="px-4 py-3">
                            <RiskBadge level={diff.significance} showLabel={false} />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Missing clauses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.missing_in_a?.length > 0 && (
              <div className="card border-red-800/40 bg-red-900/20">
                <h3 className="font-semibold text-white mb-3">Missing in {labelA}</h3>
                <ul className="space-y-1.5">
                  {result.missing_in_a.map((item, i) => (
                    <li key={i} className="text-sm text-red-200 flex gap-2">
                      <span className="flex-shrink-0" aria-hidden="true">—</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.missing_in_b?.length > 0 && (
              <div className="card border-amber-800/40 bg-amber-900/20">
                <h3 className="font-semibold text-white mb-3">Missing in {labelB}</h3>
                <ul className="space-y-1.5">
                  {result.missing_in_b.map((item, i) => (
                    <li key={i} className="text-sm text-amber-200 flex gap-2">
                      <span className="flex-shrink-0" aria-hidden="true">—</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Recommendation */}
          {result.recommendation && (
            <div className="card border-green-800/40 bg-green-900/20">
              <h3 className="font-semibold text-green-400 mb-2">Recommendation</h3>
              <p className="text-sm text-slate-200 leading-relaxed">{result.recommendation}</p>
            </div>
          )}

          <Disclaimer text={result.disclaimer} />
        </section>
      )}

      {!result && !loading && !error && (
        <EmptyState icon={ArrowLeftRight} title="Comparison results will appear here"
          description="Paste or upload two documents above and click 'Compare Documents'." />
      )}
    </div>
  );
}
