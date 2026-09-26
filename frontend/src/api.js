import axios from "axios";

// ─── Configuration ────────────────────────────────────────────────────────────

const DEFAULT_BACKEND_URL = "https://lexai-backend-2gwi.onrender.com";

/** Cache TTL in milliseconds (30 minutes). Repeat requests cost no AI credits. */
const CACHE_TTL_MS = 30 * 60 * 1000;

/** Maximum retry attempts for failed requests. */
const MAX_RETRIES = 0;

/** Base delay for exponential backoff (ms). */
const BASE_RETRY_DELAY_MS = 1000;

// ─── API Base URL ─────────────────────────────────────────────────────────────

export const getApiBase = () => {
  let rawBase = (import.meta.env.VITE_API_BASE_URL || "").trim();
  if (!rawBase || rawBase === "/api" || rawBase === "lexai-backend-2gwi") {
    return DEFAULT_BACKEND_URL;
  }
  if (!rawBase.startsWith("http://") && !rawBase.startsWith("https://") && !rawBase.startsWith("/")) {
    if (rawBase.endsWith(".onrender.com")) {
      rawBase = `https://${rawBase}`;
    } else {
      rawBase = `https://${rawBase}.onrender.com`;
    }
  }
  return rawBase.replace(/\/+$/, "");
};

// ─── In-Memory Response Cache ─────────────────────────────────────────────────

/** @type {Map<string, {data: any, timestamp: number}>} */
const responseCache = new Map();

/**
 * Generate a deterministic cache key from method + URL + body.
 * Uses JSON.stringify for the body to ensure consistent hashing.
 */
function normalize(value) {
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim();
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalize(v)]));
  }
  return value;
}

function cacheKey(method, url, body) {
  // Whitespace-insensitive, so re-submitting the same text with different spacing is a cache hit.
  return `${method}:${url}:${JSON.stringify(normalize(body || ""))}`;
}

/** Retrieve a cached response if it exists and hasn't expired. */
function getCached(key) {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    responseCache.delete(key);
    return null;
  }
  return entry.data;
}

/** Store a response in the cache. */
function setCache(key, data) {
  // Evict oldest entries if cache grows too large (max 50 entries)
  if (responseCache.size >= 50) {
    const oldestKey = responseCache.keys().next().value;
    responseCache.delete(oldestKey);
  }
  responseCache.set(key, { data, timestamp: Date.now() });
}

// ─── Request Deduplication ────────────────────────────────────────────────────

/** @type {Map<string, Promise<any>>} */
const inflightRequests = new Map();

// ─── Axios Instance ───────────────────────────────────────────────────────────

const api = axios.create({
  timeout: 120000, // 2 min timeout for large docs
  headers: { "Content-Type": "application/json" },
});

// Dynamic baseURL per request
api.interceptors.request.use((config) => {
  config.baseURL = getApiBase();
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
    const normalizedError = new Error(message || "An unexpected error occurred. Please try again.");
    normalizedError.response = error.response;
    normalizedError.status = error.response?.status;
    normalizedError.retryAfter = error.response?.headers?.["retry-after"];
    normalizedError.isQuotaError = error.response?.status === 429;
    return Promise.reject(normalizedError);
  }
);

// ─── Retry with Exponential Backoff ───────────────────────────────────────────

/**
 * Retry a request function with exponential backoff.
 * Only retries on network errors or 5xx server errors, NOT on 4xx client errors.
 */
async function withRetry(requestFn, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      const status = error.response?.status;
      const isRetryable = !error.response || status === 502 || status === 504;

      if (!isRetryable || attempt === retries) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// ─── Deduplicated + Cached POST Helper ────────────────────────────────────────

/**
 * Make a POST request with deduplication and caching.
 * - If an identical request is already in-flight, reuse its promise (dedup).
 * - If a cached response exists and hasn't expired, return it instantly.
 * - Supports AbortController for request cancellation.
 */
function cachedPost(url, body, { signal } = {}) {
  const key = cacheKey("POST", url, body);

  // 1. Check cache first
  const cached = getCached(key);
  if (cached) return Promise.resolve(cached);

  // 2. Check for in-flight duplicate
  if (inflightRequests.has(key)) {
    return inflightRequests.get(key);
  }

  // 3. Make the request with retry logic
  const promise = withRetry(() => api.post(url, body, { signal }))
    .then((data) => {
      setCache(key, data); // Cache successful responses
      return data;
    })
    .finally(() => {
      inflightRequests.delete(key); // Clean up dedup map
    });

  inflightRequests.set(key, promise);
  return promise;
}

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

// ─── Feature endpoints (with caching, dedup, and retry) ───────────────────────
export const simplifyDocument = (text, { signal } = {}) =>
  cachedPost("/simplify", { text }, { signal });

export const analyzeRisks = (text, { signal } = {}) =>
  cachedPost("/analyze-risks", { text }, { signal });

export const compareDocuments = (document_a, document_b, label_a, label_b, { signal } = {}) =>
  cachedPost("/compare", { document_a, document_b, label_a, label_b }, { signal });

export const legalQnA = (document, question, { signal } = {}) =>
  cachedPost("/qna", { document, question }, { signal });

export const getNextSteps = (situation, jurisdiction, { signal } = {}) =>
  cachedPost("/next-steps", { situation, jurisdiction }, { signal });

export const summarizeDocument = (text, { signal } = {}) =>
  cachedPost("/summarize", { text }, { signal });

export const lawyerPrep = (situation, document, { signal } = {}) =>
  cachedPost("/lawyer-prep", { situation, document }, { signal });

export default api;
