import { useState } from "react";
import { Compass, MapPin } from "lucide-react";
import { UrgencyBadge } from "../components/RiskBadge";
import { Disclaimer, LoadingCard, ErrorCard, EmptyState } from "../components/ResultCard";
import { getNextSteps } from "../api";

export default function NextSteps() {
  const [situation, setSituation] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!situation.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await getNextSteps(situation, jurisdiction);
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
          <Compass size={22} className="text-amber-400" aria-hidden="true" />
          <h1 className="section-title">Options & Next Steps</h1>
        </div>
        <p className="section-subtitle">
          Describe your legal situation and get a prioritized action plan.
        </p>
      </div>

      <div className="card space-y-4">
        <div>
          <label htmlFor="situation-desc-input" className="label text-white font-semibold">Describe Your Situation</label>
          <textarea
            id="situation-desc-input"
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            placeholder="E.g. My landlord has refused to return my security deposit of $2,000 after 45 days. They claim there was property damage but provided no itemized list..."
            rows={6}
            aria-label="Description of your legal situation"
            className="textarea-field focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:outline-none"
          />
        </div>
        <div>
          <label htmlFor="jurisdiction-input" className="label text-white font-semibold">Jurisdiction (Optional)</label>
          <input
            id="jurisdiction-input"
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
            placeholder="E.g. California, USA | United Kingdom | India (Maharashtra)"
            aria-label="Legal jurisdiction"
            className="input-field focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:outline-none"
          />
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={!situation.trim() || loading}
            aria-label="Get legal options and next steps"
            className="btn-primary focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:outline-none"
          >
            {loading ? <><span className="loading-spinner" aria-hidden="true" /> Analyzing...</> : <><Compass size={16} aria-hidden="true" /> Get Next Steps</>}
          </button>
        </div>
      </div>

      {loading && <LoadingCard message="Analyzing your situation and preparing legal options..." />}
      {error && <ErrorCard message={error} onRetry={handleSubmit} />}

      {result && !loading && (
        <section className="space-y-4 animate-slide-up" role="region" aria-label="Legal Options and Action Plan Results">
          {/* Summary */}
          <div className="card border-amber-800/40 bg-amber-900/20">
            <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2">Situation Summary</p>
            <p className="text-slate-200 text-sm leading-relaxed">{result.situation_summary}</p>
          </div>

          {/* Legal Options */}
          {result.legal_options?.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-bold text-white mb-4">Your Legal Options</h2>
              <ol className="space-y-2">
                {result.legal_options.map((option, i) => (
                  <li key={i} className="flex gap-3 text-sm text-slate-200">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-700 text-white text-xs flex items-center justify-center font-bold mt-0.5" aria-hidden="true">
                      {i + 1}
                    </span>
                    {option}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Next Steps */}
          {result.next_steps?.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <MapPin size={18} className="text-amber-400" aria-hidden="true" /> Action Plan
              </h2>
              <div className="space-y-3">
                {result.next_steps.map((step, i) => (
                  <div key={i} className="flex gap-4">
                    {/* Step number */}
                    <div className="flex-shrink-0 flex flex-col items-center" aria-hidden="true">
                      <div className="w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-700 text-white text-sm font-bold flex items-center justify-center">
                        {step.step_number}
                      </div>
                      {i < result.next_steps.length - 1 && (
                        <div className="w-0.5 flex-1 bg-slate-800 mt-1 mb-1" />
                      )}
                    </div>
                    {/* Content */}
                    <div className="pb-4 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-semibold text-white text-sm">Step {step.step_number}: {step.action}</p>
                        <UrgencyBadge level={step.urgency} />
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Important Notes */}
          {result.important_notes?.length > 0 && (
            <div className="card border-blue-800/40 bg-blue-900/20">
              <h3 className="font-semibold text-blue-300 mb-2">Important Considerations & Deadlines</h3>
              <ul className="space-y-1.5">
                {result.important_notes.map((note, i) => (
                  <li key={i} className="text-sm text-slate-200 flex gap-2">
                    <span className="text-blue-400 flex-shrink-0" aria-hidden="true">ℹ</span>
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Disclaimer text={result.disclaimer} />
        </section>
      )}

      {!result && !loading && !error && (
        <EmptyState icon={Compass} title="Legal options will appear here"
          description="Describe your legal situation above and click 'Get Next Steps'." />
      )}
    </div>
  );
}
