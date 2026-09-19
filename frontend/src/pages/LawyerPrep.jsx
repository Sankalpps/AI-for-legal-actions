import { useState } from "react";
import { Users, FileCheck, HelpCircle, AlertOctagon } from "lucide-react";
import DocumentUpload from "../components/DocumentUpload";
import { Disclaimer, LoadingCard, ErrorCard, EmptyState } from "../components/ResultCard";
import { lawyerPrep } from "../api";

export default function LawyerPrep() {
  const [situation, setSituation] = useState("");
  const [document, setDocument] = useState("");
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!situation.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await lawyerPrep(situation, document);
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
          <Users size={22} className="text-pink-400" aria-hidden="true" />
          <h1 className="section-title">Lawyer Prep Assistant</h1>
        </div>
        <p className="section-subtitle">
          Prepare targeted questions, key documents, and red flags before meeting your attorney.
        </p>
      </div>

      <div className="card space-y-4">
        <div>
          <label htmlFor="lawyer-prep-situation" className="label text-white font-semibold">Describe Your Legal Situation</label>
          <textarea
            id="lawyer-prep-situation"
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            placeholder="E.g. I was wrongfully terminated after reporting accounting discrepancies to HR..."
            rows={5}
            aria-label="Describe your legal situation for lawyer preparation"
            className="textarea-field focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:outline-none"
          />
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowDocUpload(!showDocUpload)}
            aria-expanded={showDocUpload}
            aria-controls="optional-doc-container"
            className="text-xs text-primary-400 hover:text-primary-300 font-semibold focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:outline-none rounded"
          >
            {showDocUpload ? "— Hide optional document" : "+ Add optional relevant document"}
          </button>
        </div>

        {showDocUpload && (
          <div id="optional-doc-container" className="pt-2 animate-fade-in">
            <DocumentUpload
              id="lawyer-prep-doc"
              label="Relevant Document (Optional)"
              value={document}
              onChange={setDocument}
              placeholder="Paste contract, termination letter, or evidence text..."
              minRows={5}
            />
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={!situation.trim() || loading}
            aria-label="Generate attorney consultation prep guide"
            className="btn-primary focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:outline-none"
          >
            {loading ? <><span className="loading-spinner" aria-hidden="true" /> Preparing...</> : <><Users size={16} aria-hidden="true" /> Generate Prep Guide</>}
          </button>
        </div>
      </div>

      {loading && <LoadingCard message="Generating attorney consultation prep materials..." />}
      {error && <ErrorCard message={error} onRetry={handleSubmit} />}

      {result && !loading && (
        <section className="space-y-4 animate-slide-up" role="region" aria-label="Lawyer Consultation Prep Results">
          {/* Case Summary */}
          <div className="card border-pink-800/40 bg-pink-900/20">
            <p className="text-xs font-semibold text-pink-400 uppercase tracking-wide mb-2">What to tell your lawyer (Case Intro)</p>
            <p className="text-slate-200 text-sm leading-relaxed">{result.case_summary}</p>
          </div>

          {/* Documents to Bring */}
          {result.documents_to_bring?.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <FileCheck size={18} className="text-cyan-400" aria-hidden="true" /> Documents & Evidence to Bring
              </h2>
              <ul className="space-y-2">
                {result.documents_to_bring.map((doc, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-slate-200">
                    <span className="text-cyan-400 mt-0.5 flex-shrink-0" aria-hidden="true">✓</span>
                    {doc}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Red Flags */}
          {result.red_flags?.length > 0 && (
            <div className="card border-red-800/40 bg-red-900/20">
              <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <AlertOctagon size={18} className="text-red-400" aria-hidden="true" /> Red Flags & Immediate Risks
              </h2>
              <ul className="space-y-2">
                {result.red_flags.map((flag, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-red-200">
                    <span className="text-red-400 mt-0.5 flex-shrink-0" aria-hidden="true">🚩</span>
                    {flag}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Questions to Ask */}
          {result.questions?.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <HelpCircle size={18} className="text-pink-400" aria-hidden="true" /> Questions to Ask Your Lawyer ({result.questions.length})
              </h2>
              <div className="space-y-3" role="list">
                {result.questions.map((q, i) => (
                  <div key={i} role="listitem" className="p-3.5 bg-slate-800/60 rounded-xl border border-slate-700/60">
                    <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                      <p className="text-sm font-semibold text-white">{q.question}</p>
                      <span className="text-xs px-2 py-0.5 bg-slate-800 text-pink-300 rounded border border-slate-700 font-medium">
                        {q.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">Why this matters: {q.why_important}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Disclaimer text={result.disclaimer} />
        </section>
      )}

      {!result && !loading && !error && (
        <EmptyState icon={Users} title="Consultation prep guide will appear here"
          description="Describe your legal situation above and click 'Generate Prep Guide'." />
      )}
    </div>
  );
}
