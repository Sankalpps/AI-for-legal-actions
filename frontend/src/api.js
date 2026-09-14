import axios from "axios";

const DEFAULT_BACKEND_URL = "https://lexai-backend-2gwi.onrender.com";

export const getApiBase = () => {
  let rawBase = import.meta.env.VITE_API_BASE_URL || DEFAULT_BACKEND_URL;
  if (rawBase && !rawBase.startsWith("http") && !rawBase.startsWith("/")) {
    rawBase = `https://${rawBase}`;
  }
  return rawBase.replace(/\/+$/, "");
};

const api = axios.create({
  timeout: 120000, // 2 min timeout for large docs
  headers: { "Content-Type": "application/json" },
});

// Dynamic baseURL per request
api.interceptors.request.use((config) => {
  config.baseURL = getApiBase();
  console.log(`[API] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
  return config;
});

// Response interceptor for error normalization
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    let message =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message;

    if (error.message === "Network Error") {
      const currentUrl = getApiBase();
      message = `Network Error: Unable to connect to backend (${currentUrl}). If the free Render backend is spinning up from idle, please wait ~30 seconds and click Try Again.`;
    }
    return Promise.reject(new Error(message || "An unexpected error occurred. Please try again."));
  }
);

// ─── Upload file and extract text ─────────────────────────────────────────────
export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  const base = getApiBase();
  return axios.post(`${base}/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 60000,
  }).then((r) => r.data);
};

// ─── Feature endpoints ─────────────────────────────────────────────────────────
export const simplifyDocument = (text) =>
  api.post("/simplify", { text });

export const analyzeRisks = (text) =>
  api.post("/analyze-risks", { text });

export const compareDocuments = (document_a, document_b, label_a, label_b) =>
  api.post("/compare", { document_a, document_b, label_a, label_b });

export const legalQnA = (document, question) =>
  api.post("/qna", { document, question });

export const getNextSteps = (situation, jurisdiction) =>
  api.post("/next-steps", { situation, jurisdiction });

export const summarizeDocument = (text) =>
  api.post("/summarize", { text });

export const lawyerPrep = (situation, document) =>
  api.post("/lawyer-prep", { situation, document });

export default api;
