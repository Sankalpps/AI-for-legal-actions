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
} from "lucide-react";
import clsx from "clsx";

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
  return (
    <aside aria-label="Sidebar navigation" className="w-64 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col h-screen">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-900/50" aria-hidden="true">
            <Scale size={20} className="text-white" />
          </div>
          <div>
            <span className="text-xl font-bold text-white">LexAI</span>
            <p className="text-xs text-slate-400 leading-none mt-0.5">Legal Assistant</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav aria-label="Main Navigation" className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            aria-label={label}
            className={({ isActive }) =>
              clsx(
                "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:outline-none",
                isActive
                  ? "bg-primary-600/20 text-primary-400 border border-primary-700/40"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={16}
                  aria-hidden="true"
                  className={clsx(
                    "flex-shrink-0 transition-colors",
                    isActive ? "text-primary-400" : "text-slate-400 group-hover:text-slate-200"
                  )}
                />
                <span className="flex-1">{label}</span>
                {isActive && (
                  <ChevronRight size={14} aria-hidden="true" className="text-primary-400 opacity-70" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-slate-800" role="region" aria-label="Legal Disclaimer Notice">
        <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl p-3">
          <p className="text-xs text-amber-400 font-semibold mb-1">⚠ Legal Disclaimer</p>
          <p className="text-xs text-amber-200/80 leading-relaxed">
            LexAI provides information only. Always consult a qualified legal professional.
          </p>
        </div>
      </div>
    </aside>
  );
}
