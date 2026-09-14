import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Home from "./pages/Home";
import Simplify from "./pages/Simplify";
import Compare from "./pages/Compare";
import RiskAnalysis from "./pages/RiskAnalysis";
import QnA from "./pages/QnA";
import NextSteps from "./pages/NextSteps";
import Summary from "./pages/Summary";
import LawyerPrep from "./pages/LawyerPrep";

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden bg-slate-950">
        {/* Sidebar */}
        <Sidebar />

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-8">
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
          </div>
        </main>
      </div>
    </BrowserRouter>
  );
}
