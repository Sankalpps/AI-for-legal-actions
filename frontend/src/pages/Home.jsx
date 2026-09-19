import { useNavigate } from "react-router-dom";
import {
  Scale, FileText, AlertTriangle, GitCompare,
  MessageSquare, Compass, ClipboardList, Users,
  ArrowRight, Shield, Zap, Globe,
} from "lucide-react";

const features = [
  {
    to: "/simplify",
    icon: FileText,
    title: "Simplify Document",
    desc: "Transform complex legal jargon into plain English anyone can understand.",
    color: "text-blue-400",
    bg: "bg-blue-900/20 border-blue-800/40",
  },
  {
    to: "/risks",
    icon: AlertTriangle,
    title: "Risk Analysis",
    desc: "Identify risky clauses, hidden obligations, and inconsistencies.",
    color: "text-red-400",
    bg: "bg-red-900/20 border-red-800/40",
  },
  {
    to: "/compare",
    icon: GitCompare,
    title: "Compare Contracts",
    desc: "Side-by-side comparison of two documents with significance ratings.",
    color: "text-purple-400",
    bg: "bg-purple-900/20 border-purple-800/40",
  },
  {
    to: "/qna",
    icon: MessageSquare,
    title: "Legal Q&A",
    desc: "Ask questions about your document and get grounded, cited answers.",
    color: "text-green-400",
    bg: "bg-green-900/20 border-green-800/40",
  },
  {
    to: "/next-steps",
    icon: Compass,
    title: "Options & Next Steps",
    desc: "Understand your legal options and get a prioritized action plan.",
    color: "text-amber-400",
    bg: "bg-amber-900/20 border-amber-800/40",
  },
  {
    to: "/summary",
    icon: ClipboardList,
    title: "Summary & Checklist",
    desc: "Get an executive summary and actionable checklist from any document.",
    color: "text-cyan-400",
    bg: "bg-cyan-900/20 border-cyan-800/40",
  },
  {
    to: "/lawyer-prep",
    icon: Users,
    title: "Lawyer Prep",
    desc: "Prepare targeted questions and materials before meeting your attorney.",
    color: "text-pink-400",
    bg: "bg-pink-900/20 border-pink-800/40",
  },
];

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <section aria-label="Hero Introduction" className="text-center py-10 mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary-900/30 border border-primary-700/40 rounded-full text-primary-400 text-xs font-semibold mb-5">
          <Zap size={12} aria-hidden="true" />
          Powered by Google Gemini 3.6 Flash
        </div>
        <h1 className="text-5xl font-extrabold text-white mb-4 leading-tight">
          Legal Assistance,
          <br />
          <span className="text-primary-400">Made Accessible</span>
        </h1>
        <p className="text-slate-300 text-lg max-w-2xl mx-auto mb-8 leading-relaxed">
          LexAI uses advanced AI to help you understand, analyze, and navigate 
          legal documents — without needing a law degree.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <button
            onClick={() => navigate("/simplify")}
            aria-label="Get started by simplifying a legal document"
            className="btn-primary text-base px-6 py-3 focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:outline-none"
          >
            Get Started <ArrowRight size={18} aria-hidden="true" />
          </button>
          <button
            onClick={() => navigate("/qna")}
            aria-label="Ask a legal question"
            className="btn-secondary text-base px-6 py-3 focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:outline-none"
          >
            Ask a Question
          </button>
        </div>
      </section>

      {/* Trust badges */}
      <div className="flex items-center justify-center gap-8 mb-10 text-xs text-slate-400 flex-wrap" role="region" aria-label="Trust Badges">
        <div className="flex items-center gap-1.5">
          <Shield size={14} className="text-green-400" aria-hidden="true" />
          <span>Confidential & Secure</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Globe size={14} className="text-blue-400" aria-hidden="true" />
          <span>Supports all jurisdictions</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Scale size={14} className="text-amber-400" aria-hidden="true" />
          <span>Not legal advice — always consult a lawyer</span>
        </div>
      </div>

      {/* Feature grid */}
      <section aria-label="Features Directory">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" role="list">
          {features.map(({ to, icon: Icon, title, desc, color, bg }) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              role="listitem"
              aria-label={`Open ${title}: ${desc}`}
              className={`card-hover text-left border ${bg} group focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:outline-none`}
            >
              <div className={`inline-flex p-2 rounded-xl ${bg} mb-4`} aria-hidden="true">
                <Icon size={22} className={color} />
              </div>
              <h2 className="text-white font-semibold text-lg mb-1.5 group-hover:text-primary-300 transition-colors">
                {title}
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">{desc}</p>
              <div className={`mt-3 text-xs font-semibold ${color} flex items-center gap-1`} aria-hidden="true">
                Open feature <ArrowRight size={12} />
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
