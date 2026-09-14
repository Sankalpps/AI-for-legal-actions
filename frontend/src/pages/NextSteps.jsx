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
          <Compass size={22} className="text-amber-400" />
          <h1 className="section-title">Options & Next Steps</h1>
        </div>
        <p className="section-subtitle">
          Describe your legal situation and get a prioritized action plan.
        </p>
      </div>

      <div className="card space-y-4">
        <div>
          <label className="label">Describe Your Situation</label>
          <textarea
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            placeholder="E.g. My landlord has refused to return my security deposit of $2,000 after 45 days. They claim there was property damage but provided no itemized list..."
            rows={6}
            className="textarea-field"
          />
        </div>
        <div>
          <label className="label">Jurisdiction (Optional)</label>
          <input
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
            placeholder="E.g. California, USA | United Kingdom | India (Maharashtra)"
            className="input-field"
          />
        </div>
        <div className="flex justify-end">
          <button onClick={handleSubmit} disabled={!situation.trim() || loading} className="btn-primary">
            {loading ? <><span className="loading-spinner" /> Analyzing...</> : <><Compass size={16} /> Get Next Steps</>}
          </button>
        </div>
      </div>

      {loading && <LoadingCard message="Analyzing your situation..." />}
      {error && <ErrorCard message={error} onRetry={handleSubmit} />}

      {result && !loading && (
        <div className="space-y-4 animate-slide-up">
          {/* Summary */}
          <div className="card border-amber-800/40 bg-amber-900/10">
            <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2">Situation Summary</p>
            <p className="text-slate-200 text-sm leading-relaxed">{result.situation_summary}</p>
          </div>

          {/* Legal Options */}
          {result.legal_options?.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-bold text-white mb-4">Your Legal Options</h2>
              <ol className="space-y-2">
                {result.legal_options.map((option, i) => (
                  <li key={i} className="flex gap-3 text-sm text-slate-300">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-700 text-white text-xs flex items-center justify-center font-bold mt-0.5">
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
                <MapPin size={18} className="text-amber-400" /> Action Plan
              </h2>
              <div className="space-y-3">
                {result.next_steps.map((step, i) => (
                  <div key={i} className="flex gap-4">
                    {/* Step number */}
                    <div className="flex-shrink-0 flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-700 text-white text-sm font-bold flex items-center justify-center">
                        {step.step_number}
                      </div>
                      {i < result.next_steps.length - 1 && (
                        <div className="w-0.5 flex-1 bg-slate-800 mt-1 mb-1" />
                      )}
                    </div>
                    {/* Content */}
                    <div className="pb-4 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-white text-sm">{step.action}</p>
                        <UrgencyBadge level={step.urgency} />
                      </div>
                      <p className="text-sm text-slate-400 leading-relaxed">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Important Notes */}
          {result.important_notes?.length > 0 && (
            <div className="card border-red-800/40 bg-red-900/10">
              <h2 className="text-lg font-bold text-white mb-3">⚠ Important Notes</h2>
              <ul className="space-y-2">
                {result.important_notes.map((note, i) => (
                  <li key={i} className="text-sm text-red-300 flex gap-2">
                    <span className="flex-shrink-0">•</span>{note}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Disclaimer text={result.disclaimer} />
        </div>
      )}

      {!result && !loading && !error && (
        <EmptyState icon={Compass} title="Your action plan will appear here"
          description="Describe your legal situation above and click 'Get Next Steps'." />
      )}
    </div>
  );
}
