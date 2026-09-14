import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Scale,
  FileText,
  AlertTriangle,
  GitCompare,
  MessageSquare,
  Compass,
  ClipboardList,
  Users,
  ChevronRight,
  Settings,
  Check,
} from "lucide-react";
import clsx from "clsx";
import { getApiBase, setApiBase } from "../api";

const navItems = [
  { to: "/", icon: Scale, label: "Home", exact: true },
  { to: "/simplify", icon: FileText, label: "Simplify Document" },
  { to: "/risks", icon: AlertTriangle, label: "Risk Analysis" },
  { to: "/compare", icon: GitCompare, label: "Compare Contracts" },
  { to: "/qna", icon: MessageSquare, label: "Legal Q&A" },
  { to: "/next-steps", icon: Compass, label: "Next Steps" },
  { to: "/summary", icon: ClipboardList, label: "Summary & Checklist" },
  { to: "/lawyer-prep", icon: Users, label: "Lawyer Prep" },
];

export default function Sidebar() {
  const [showConfig, setShowConfig] = useState(false);
  const [apiUrl, setApiUrl] = useState(() => getApiBase());
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setApiBase(apiUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <aside className="w-64 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col h-screen">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-900/50">
            <Scale size={20} className="text-white" />
          </div>
          <div>
            <span className="text-xl font-bold text-white">LexAI</span>
            <p className="text-xs text-slate-500 leading-none mt-0.5">Legal Assistant</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              clsx(
                "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-primary-600/20 text-primary-400 border border-primary-700/40"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={16}
                  className={clsx(
                    "flex-shrink-0 transition-colors",
                    isActive ? "text-primary-400" : "text-slate-500 group-hover:text-slate-300"
                  )}
                />
                <span className="flex-1">{label}</span>
                {isActive && (
                  <ChevronRight size={14} className="text-primary-400 opacity-70" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-800 space-y-2">
        {/* Backend URL Settings toggle */}
        <div>
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-white px-2 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Settings size={13} />
              Backend Connection
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              {showConfig ? "▲" : "▼"}
            </span>
          </button>

          {showConfig && (
            <div className="mt-2 p-2.5 bg-slate-800/80 border border-slate-700 rounded-xl space-y-2 animate-slide-up">
              <label className="block text-[11px] font-semibold text-slate-300">
                Backend API URL
              </label>
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://lexai-backend.onrender.com"
                className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-primary-500 font-mono"
              />
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex-1 text-xs bg-primary-600 hover:bg-primary-500 text-white font-medium py-1 px-2 rounded-lg flex items-center justify-center gap-1 transition-colors"
                >
                  {saved ? <><Check size={12} /> Saved</> : "Apply"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setApiBase(null);
                    setApiUrl(getApiBase());
                    setSaved(true);
                    setTimeout(() => setSaved(false), 2000);
                  }}
                  className="text-[10px] text-slate-500 hover:text-slate-300 px-1"
                >
                  Reset
                </button>
              </div>
              <p className="text-[10px] text-slate-500 leading-tight">
                Paste your Render backend URL here if you get a Network Error.
              </p>
            </div>
          )}
        </div>

        {/* Legal Disclaimer */}
        <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl p-2.5">
          <p className="text-[11px] text-amber-400/80 font-medium mb-0.5">⚠ Disclaimer</p>
          <p className="text-[10px] text-amber-300/60 leading-relaxed">
            LexAI provides information only. Consult a qualified attorney.
          </p>
        </div>
      </div>
    </aside>
  );
}
