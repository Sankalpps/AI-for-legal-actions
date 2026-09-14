import { useState } from "react";
import { Users, HelpCircle, Briefcase, AlertOctagon } from "lucide-react";
import DocumentUpload from "../components/DocumentUpload";
import { Disclaimer, LoadingCard, ErrorCard, EmptyState } from "../components/ResultCard";
import { lawyerPrep } from "../api";

const categoryColors = {
  "Rights & Obligations": "text-blue-400 bg-blue-900/20 border-blue-800/40",
  "Timeline": "text-purple-400 bg-purple-900/20 border-purple-800/40",
  "Costs & Fees": "text-green-400 bg-green-900/20 border-green-800/40",
  "Strategy": "text-cyan-400 bg-cyan-900/20 border-cyan-800/40",
  "Risks": "text-red-400 bg-red-900/20 border-red-800/40",
  "Evidence": "text-amber-400 bg-amber-900/20 border-amber-800/40",
  "Settlement": "text-pink-400 bg-pink-900/20 border-pink-800/40",
};

function getCategoryClass(cat) {
  for (const [key, cls] of Object.entries(categoryColors)) {
    if (cat?.includes(key)) return cls;
  }
  return "text-slate-400 bg-slate-800/40 border-slate-700";
}

export default function LawyerPrep() {
  const [situation, setSituation] = useState("");
  const [document, setDocument] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);

  const handleSubmit = async () => {
    if (!situation.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setActiveCategory(null);
    try {
      const data = await lawyerPrep(situation, document || undefined);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Group questions by category
  const groupedQuestions = result?.questions?.reduce((acc, q) => {
    const cat = q.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(q);
    return acc;
  }, {});

  const categories = groupedQuestions ? Object.keys(groupedQuestions) : [];
  const displayCategory = activeCategory || categories[0];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Users size={22} className="text-pink-400" />
          <h1 className="section-title">Lawyer Prep Assistant</h1>
        </div>
        <p className="section-subtitle">
          Prepare targeted questions and materials before meeting your attorney.
        </p>
      </div>

      <div className="card space-y-4">
        <div>
          <label className="label">Describe Your Situation</label>
          <textarea
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            placeholder="Describe your legal situation in detail — the more specific, the better the questions generated."
            rows={5}
            className="textarea-field"
          />
        </div>
        <DocumentUpload
          label="Relevant Document (Optional)"
          value={document}
          onChange={setDocument}
          placeholder="Paste any relevant contract, letter, or document..."
          minRows={4}
        />
        <div className="flex justify-end">
          <button onClick={handleSubmit} disabled={!situation.trim() || loading} className="btn-primary">
            {loading ? <><span className="loading-spinner" /> Preparing...</> : <><HelpCircle size={16} /> Generate Prep Guide</>}
          </button>
        </div>
      </div>

      {loading && <LoadingCard message="Preparing your lawyer consultation guide..." />}
      {error && <ErrorCard message={error} onRetry={handleSubmit} />}

      {result && !loading && (
        <div className="space-y-4 animate-slide-up">
          {/* Case Summary */}
          <div className="card border-pink-800/40 bg-pink-900/10">
            <p className="text-xs font-semibold text-pink-400 uppercase tracking-wide mb-2">What to tell your lawyer</p>
            <p className="text-slate-200 text-sm leading-relaxed">{result.case_summary}</p>
          </div>

          {/* Documents to Bring */}
          {result.documents_to_bring?.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Briefcase size={18} className="text-pink-400" /> Documents to Bring
              </h2>
              <ul className="space-y-2">
                {result.documents_to_bring.map((doc, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-slate-300">
                    <span className="text-pink-400 flex-shrink-0">📄</span>
                    {doc}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Questions — Tabbed by category */}
          {groupedQuestions && categories.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">
                  Questions to Ask ({result.questions?.length || 0})
                </h2>
              </div>

              {/* Category tabs */}
              <div className="flex flex-wrap gap-2 mb-4">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
                      displayCategory === cat
                        ? getCategoryClass(cat)
                        : "text-slate-500 bg-slate-800/40 border-slate-700 hover:text-slate-300"
                    }`}
                  >
                    {cat} ({groupedQuestions[cat].length})
                  </button>
                ))}
              </div>

              {/* Questions for selected category */}
              {groupedQuestions[displayCategory] && (
                <div className="space-y-3">
                  {groupedQuestions[displayCategory].map((q, i) => (
                    <div key={i} className="p-4 bg-slate-800/60 rounded-xl border border-slate-700">
                      <p className="text-sm font-semibold text-white mb-1">
                        {i + 1}. {q.question}
                      </p>
                      <p className="text-xs text-slate-500">{q.why_important}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Red Flags */}
          {result.red_flags?.length > 0 && (
            <div className="card border-red-800/40 bg-red-900/10">
              <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <AlertOctagon size={18} className="text-red-400" /> Red Flags
              </h2>
              <ul className="space-y-2">
                {result.red_flags.map((flag, i) => (
                  <li key={i} className="text-sm text-red-300 flex gap-2">
                    <span className="flex-shrink-0 text-red-500">🚩</span>
                    {flag}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Disclaimer text={result.disclaimer} />
        </div>
      )}

      {!result && !loading && !error && (
        <EmptyState icon={HelpCircle} title="Your prep guide will appear here"
          description="Describe your situation above and click 'Generate Prep Guide'." />
      )}
    </div>
  );
}
