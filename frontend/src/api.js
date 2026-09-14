import axios from "axios";

let rawBase = import.meta.env.VITE_API_BASE_URL || "/api";
if (rawBase && !rawBase.startsWith("http") && !rawBase.startsWith("/")) {
  rawBase = `https://${rawBase}`;
}
const API_BASE = rawBase;

const api = axios.create({
  baseURL: API_BASE,
  timeout: 120000, // 2 min timeout for large docs
  headers: { "Content-Type": "application/json" },
});

// Request interceptor for logging
api.interceptors.request.use((config) => {
  console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

// Response interceptor for error normalization
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message ||
      "An unexpected error occurred. Please try again.";
    return Promise.reject(new Error(message));
  }
);

// ─── Upload file and extract text ─────────────────────────────────────────────
export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  return axios.post(`${API_BASE}/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 30000,
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
