import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";

// ─── Lazy-loaded pages for code-splitting (efficiency: only load the page the user visits) ───
const Home = lazy(() => import("./pages/Home"));
const Simplify = lazy(() => import("./pages/Simplify"));
const Compare = lazy(() => import("./pages/Compare"));
const RiskAnalysis = lazy(() => import("./pages/RiskAnalysis"));
const QnA = lazy(() => import("./pages/QnA"));
const NextSteps = lazy(() => import("./pages/NextSteps"));
const Summary = lazy(() => import("./pages/Summary"));
const LawyerPrep = lazy(() => import("./pages/LawyerPrep"));

/** Minimal loading fallback shown while a lazy chunk loads. */
function PageLoader() {
  return (
    <div className="flex items-center justify-center py-32" role="status" aria-live="polite">
      <div className="relative">
        <div className="w-10 h-10 rounded-full border-2 border-primary-700" />
        <div className="absolute inset-0 w-10 h-10 rounded-full border-2 border-primary-400 border-t-transparent animate-spin" />
      </div>
      <span className="sr-only">Loading page content...</span>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      {/* WCAG 2.1 AA Accessibility: Skip to main content link for keyboard & screen reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-3 focus:left-3 focus:px-4 focus:py-2 focus:bg-primary-600 focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-white text-sm font-semibold"
      >
        Skip to main content
      </a>

      <div className="flex h-screen overflow-hidden bg-slate-950">
        {/* Sidebar Navigation Landmark */}
        <Sidebar />

        {/* Main content Landmark */}
        <main id="main-content" tabIndex={-1} aria-label="Main content" className="flex-1 overflow-y-auto focus:outline-none">
          <div className="max-w-5xl mx-auto px-6 py-8">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/simplify" element={<Simplify />} />
                <Route path="/risks" element={<RiskAnalysis />} />
                <Route path="/compare" element={<Compare />} />
                <Route path="/qna" element={<QnA />} />
                <Route path="/next-steps" element={<NextSteps />} />
                <Route path="/summary" element={<Summary />} />
                <Route path="/lawyer-prep" element={<LawyerPrep />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </div>
        </main>
      </div>
    </BrowserRouter>
  );
}
