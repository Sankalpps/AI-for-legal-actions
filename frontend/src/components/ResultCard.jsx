import { AlertCircle } from "lucide-react";

/**
 * Reusable disclaimer box with ARIA note role.
 */
export function Disclaimer({ text }) {
  if (!text) return null;
  return (
    <div className="disclaimer-box" role="note" aria-label="Legal disclaimer">
      <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-amber-400" aria-hidden="true" />
      <p className="text-amber-200/90">{text}</p>
    </div>
  );
}

/**
 * Accessible loading state card with role="status" and aria-live="polite".
 */
export function LoadingCard({ message = "Analyzing document..." }) {
  return (
    <div
      className="card flex flex-col items-center justify-center py-16 gap-4 animate-fade-in"
      role="status"
      aria-live="polite"
    >
      <div className="relative" aria-hidden="true">
        <div className="w-14 h-14 rounded-full border-2 border-primary-700" />
        <div className="absolute inset-0 w-14 h-14 rounded-full border-2 border-primary-400 border-t-transparent animate-spin" />
      </div>
      <div className="text-center">
        <p className="text-white font-semibold text-base">{message}</p>
        <p className="text-sm text-slate-300 mt-1">This may take a few seconds for longer documents.</p>
      </div>
    </div>
  );
}

/**
 * Accessible error state card with role="alert" and aria-live="assertive".
 */
export function ErrorCard({ message, onRetry }) {
  const isQuotaError = message?.toLowerCase().includes("quota");

  return (
    <div
      className="card border-red-800 bg-red-900/20 animate-fade-in"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={20} aria-hidden="true" />
        <div>
          <h3 className="text-red-200 font-semibold mb-1">Something went wrong</h3>
          <p className="text-red-300 text-sm">{message}</p>
          {onRetry && !isQuotaError && (
            <button
              onClick={onRetry}
              aria-label="Retry action"
              className="mt-3 text-sm text-red-300 hover:text-white underline font-medium focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none rounded"
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
    <div className="flex items-center gap-3 my-6" aria-hidden="true">
      <div className="flex-1 h-px bg-slate-800" />
      {label && <span className="text-xs text-slate-400 font-semibold uppercase tracking-widest">{label}</span>}
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
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide w-28 flex-shrink-0 mt-0.5">{label}</span>
      <span className="text-sm text-slate-200">{value}</span>
    </div>
  );
}

/**
 * Accessible empty state.
 */
export function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="card text-center py-12 animate-fade-in" role="region" aria-label={title}>
      {Icon && <Icon className="mx-auto mb-3 text-slate-400" size={40} aria-hidden="true" />}
      <p className="text-slate-300 font-medium">{title}</p>
      {description && <p className="text-sm text-slate-400 mt-1">{description}</p>}
    </div>
  );
}
