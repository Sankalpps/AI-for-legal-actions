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
    <div className="flex items-center justify-center py-32">
      <div className="relative">
        <div className="w-10 h-10 rounded-full border-2 border-primary-700" />
        <div className="absolute inset-0 w-10 h-10 rounded-full border-2 border-primary-400 border-t-transparent animate-spin" />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden bg-slate-950">
        {/* Sidebar */}
        <Sidebar />

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
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
