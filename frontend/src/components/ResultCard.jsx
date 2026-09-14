import { AlertCircle } from "lucide-react";

/**
 * Reusable disclaimer box.
 */
export function Disclaimer({ text }) {
  if (!text) return null;
  return (
    <div className="disclaimer-box">
      <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
      <p>{text}</p>
    </div>
  );
}

/**
 * Loading state card.
 */
export function LoadingCard({ message = "Analyzing document..." }) {
  return (
    <div className="card flex flex-col items-center justify-center py-16 gap-4 animate-fade-in">
      <div className="relative">
        <div className="w-14 h-14 rounded-full border-2 border-primary-700" />
        <div className="absolute inset-0 w-14 h-14 rounded-full border-2 border-primary-400 border-t-transparent animate-spin" />
      </div>
      <div className="text-center">
        <p className="text-white font-semibold">{message}</p>
        <p className="text-sm text-slate-500 mt-1">This may take a few seconds for longer documents.</p>
      </div>
    </div>
  );
}

/**
 * Error state card.
 */
export function ErrorCard({ message, onRetry }) {
  return (
    <div className="card border-red-800 bg-red-900/10 animate-fade-in">
      <div className="flex items-start gap-3">
        <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
        <div>
          <p className="text-red-300 font-semibold mb-1">Something went wrong</p>
          <p className="text-red-400/80 text-sm">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 text-sm text-red-300 hover:text-white underline"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Section divider with label.
 */
export function SectionDivider({ label }) {
  return (
    <div className="flex items-center gap-3 my-6">
      <div className="flex-1 h-px bg-slate-800" />
      {label && <span className="text-xs text-slate-600 font-semibold uppercase tracking-widest">{label}</span>}
      <div className="flex-1 h-px bg-slate-800" />
    </div>
  );
}

/**
 * Info row in a detail grid.
 */
export function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide w-28 flex-shrink-0 mt-0.5">{label}</span>
      <span className="text-sm text-slate-200">{value}</span>
    </div>
  );
}

/**
 * Empty state.
 */
export function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="card text-center py-12 animate-fade-in">
      {Icon && <Icon className="mx-auto mb-3 text-slate-600" size={40} />}
      <p className="text-slate-400 font-medium">{title}</p>
      {description && <p className="text-sm text-slate-600 mt-1">{description}</p>}
    </div>
  );
}
