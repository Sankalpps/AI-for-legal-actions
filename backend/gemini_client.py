"""
Gemini API client wrapper.
Handles model initialization, API calls, JSON extraction, caching, and error handling.

Cost controls built in (every real provider call costs credits):
  * response cache (normalised key, LRU + TTL)  - identical requests are free
  * in-flight de-duplication                     - concurrent identical requests share ONE call
  * per-call output-token ceiling                - set per feature by the caller
  * daily call budget (DAILY_AI_CALL_LIMIT)      - hard stop against runaway spend
"""
import os
import json
import re
import time
import hashlib
import logging
import importlib
import asyncio
from collections import OrderedDict
from typing import Any, Optional
from openai import AsyncOpenAI, OpenAI
from dotenv import load_dotenv

load_dotenv(override=True)
logger = logging.getLogger(__name__)

# Configure available providers. Gemini remains the default for existing setups.
# Prefer lower-cost models to conserve credits unless you specifically need a newer premium option.
AI_PROVIDER = os.getenv("AI_PROVIDER", "gemini").strip().lower()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash-lite")
AI_REQUEST_TIMEOUT = float(os.getenv("AI_REQUEST_TIMEOUT", "90"))
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
MAX_OUTPUT_TOKENS = int(os.getenv("MAX_OUTPUT_TOKENS", "2048"))   # global ceiling for any single call
DAILY_AI_CALL_LIMIT = int(os.getenv("DAILY_AI_CALL_LIMIT", "300"))  # real provider calls per UTC day; 0 = unlimited

if AI_PROVIDER not in {"gemini", "openai", "auto"}:
    raise ValueError("AI_PROVIDER must be 'gemini', 'openai', or 'auto'")

genai: Any = None
if AI_PROVIDER in {"gemini", "auto"}:
    genai = importlib.import_module("google.generativeai")
    genai.configure(
        api_key=os.getenv("GEMINI_API_KEY"),
        transport=os.getenv("GEMINI_TRANSPORT", "rest"),
    )

# Safety settings - permissive for legal content
SAFETY_SETTINGS = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
]

GENERATION_CONFIG = {
    "temperature": 0.1,        # Low temperature = deterministic, consistent outputs
    "top_p": 0.95,
    "top_k": 40,
    "max_output_tokens": MAX_OUTPUT_TOKENS,
    "response_mime_type": "application/json",  # Force JSON output
}

# ─── LRU Cache with TTL ───────────────────────────────────────────────────────

# Cache configuration
CACHE_MAX_SIZE = int(os.getenv("CACHE_MAX_SIZE", "300"))    # Max cached responses (~5-10 KB each)
CACHE_TTL_SECONDS = int(os.getenv("CACHE_TTL", "604800"))   # 7 day TTL - legal text analysis is deterministic


class BudgetExceeded(RuntimeError):
    """Raised when the daily cap on real AI provider calls has been reached."""


class DailyBudget:
    """Counts real provider calls per UTC day and refuses further calls past the limit."""

    def __init__(self, limit: int = DAILY_AI_CALL_LIMIT):
        self.limit = limit
        self._day = self._today()
        self.used = 0

    @staticmethod
    def _today() -> str:
        return time.strftime("%Y-%m-%d", time.gmtime())

    def consume(self) -> None:
        today = self._today()
        if today != self._day:
            self._day, self.used = today, 0
        if self.limit and self.used >= self.limit:
            raise BudgetExceeded(
                f"Daily AI call budget of {self.limit} reached (quota). Cached results still work; "
                "try again tomorrow or raise DAILY_AI_CALL_LIMIT."
            )
        self.used += 1

    @property
    def stats(self) -> dict:
        return {"limit": self.limit, "used_today": self.used}


class LRUCache:
    """
    Thread-safe LRU cache with TTL (time-to-live) expiration.
    Prevents redundant Gemini API calls for identical prompts.
    """

    def __init__(self, max_size: int = CACHE_MAX_SIZE, ttl: int = CACHE_TTL_SECONDS):
        self._cache: OrderedDict[str, dict] = OrderedDict()
        self._max_size = max_size
        self._ttl = ttl
        self.hits = 0
        self.misses = 0

    def _hash_key(self, prompt: str) -> str:
        """Deterministic SHA-256 of the prompt with whitespace normalised, so trivially
        different spacing/newlines of the same request still hit the cache."""
        normalised = " ".join(prompt.split())
        return hashlib.sha256(normalised.encode("utf-8")).hexdigest()

    def key(self, prompt: str) -> str:
        return self._hash_key(prompt)

    def get(self, prompt: str) -> Optional[dict]:
        """Retrieve a cached response if it exists and hasn't expired."""
        key = self._hash_key(prompt)
        if key not in self._cache:
            self.misses += 1
            return None

        entry = self._cache[key]
        # Check TTL expiration
        if time.time() - entry["timestamp"] > self._ttl:
            del self._cache[key]
            self.misses += 1
            return None

        # Move to end (most recently used)
        self._cache.move_to_end(key)
        self.hits += 1
        logger.info(f"Cache HIT (hits={self.hits}, misses={self.misses}, size={len(self._cache)})")
        return entry["data"]

    def put(self, prompt: str, data: dict) -> None:
        """Store a response in the cache, evicting the oldest entry if full."""
        key = self._hash_key(prompt)

        # Evict oldest if at capacity
        if len(self._cache) >= self._max_size:
            evicted_key, _ = self._cache.popitem(last=False)
            logger.debug(f"Cache evicted oldest entry, size={len(self._cache)}")

        self._cache[key] = {"data": data, "timestamp": time.time()}

    def pop(self, prompt: str) -> None:
        """Remove one entry (e.g. a response that later failed validation)."""
        self._cache.pop(self._hash_key(prompt), None)

    def clear(self) -> None:
        """Clear the entire cache."""
        self._cache.clear()
        self.hits = 0
        self.misses = 0

    @property
    def stats(self) -> dict:
        """Return cache performance statistics."""
        total = self.hits + self.misses
        hit_rate = (self.hits / total * 100) if total > 0 else 0
        return {
            "size": len(self._cache),
            "max_size": self._max_size,
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate_percent": round(hit_rate, 1),
            "ttl_seconds": self._ttl,
        }


# ─── Gemini Client ────────────────────────────────────────────────────────────


class GeminiClient:
    """
    Singleton Gemini API client with built-in LRU caching and response timing.
    """

    def __init__(self):
        self.provider = AI_PROVIDER
        self.providers = ["gemini", "openai"] if self.provider == "auto" else [self.provider]
        self.model_name = GEMINI_MODEL if self.providers[0] == "gemini" else OPENAI_MODEL
        self.model: Any = None
        self.gemini_model: Any = None
        self.openai_client: Any = None
        self.openai_async_client: Any = None

        if "gemini" in self.providers and os.getenv("GEMINI_API_KEY"):
            gemini_module = genai or importlib.import_module("google.generativeai")
            self.gemini_model = gemini_module.GenerativeModel(
                model_name=GEMINI_MODEL,
                generation_config=GENERATION_CONFIG,
                safety_settings=SAFETY_SETTINGS,
            )
            self.model = self.gemini_model

        if "openai" in self.providers:
            api_key = os.getenv("OPENAI_API_KEY")
            if api_key:
                self.openai_client = OpenAI(api_key=api_key)
                self.openai_async_client = AsyncOpenAI(api_key=api_key)
            elif len(self.providers) == 1:
                raise ValueError("OPENAI_API_KEY is required when AI_PROVIDER=openai")

        if not self.model and not self.openai_client:
            raise ValueError("At least one AI provider API key is required")

        self._cache = LRUCache()
        self._budget = DailyBudget()
        self._inflight: dict = {}

    @staticmethod
    def _ceiling(max_tokens: Optional[int]) -> int:
        """Effective output-token limit: the caller's per-feature cap, bounded by the global ceiling."""
        return min(max_tokens, MAX_OUTPUT_TOKENS) if max_tokens else MAX_OUTPUT_TOKENS

    @staticmethod
    def _log_usage(response: Any, elapsed_ms: int, label: str) -> None:
        """Log token usage (Gemini) so real spend per call is visible in the logs."""
        usage = getattr(response, "usage_metadata", None)
        if usage is not None:
            logger.info(
                f"{label} {elapsed_ms}ms tokens: in={getattr(usage, 'prompt_token_count', '?')} "
                f"out={getattr(usage, 'candidates_token_count', '?')}"
            )
        else:
            logger.info(f"{label} {elapsed_ms}ms")

    def generate(self, prompt: str, use_cache: bool = True, max_tokens: Optional[int] = None) -> dict:
        """
        Send prompt to the provider and return parsed JSON response.
        Uses LRU cache to avoid redundant API calls for identical prompts.
        Raises ValueError if response cannot be parsed as JSON.
        Raises BudgetExceeded when the daily call budget is used up.
        """
        if use_cache:
            cached = self._cache.get(prompt)
            if cached is not None:
                return cached

        start_time = time.time()
        raw_text = ""
        try:
            raw_text = self._generate_text(prompt, max_tokens)
            parsed = self._parse_json(raw_text)

            elapsed_ms = round((time.time() - start_time) * 1000)
            logger.info(f"{self.provider} API call completed in {elapsed_ms}ms (response length: {len(raw_text)} chars)")

            if use_cache:
                self._cache.put(prompt, parsed)

            return parsed
        except BudgetExceeded:
            raise
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e}. Raw response: {raw_text[:500]}")
            raise ValueError(f"Failed to parse model response as JSON: {e}")
        except Exception as e:
            message = str(e) or e.__class__.__name__
            logger.error(f"{self.provider} API error: {message}")
            raise RuntimeError(f"{self.provider} API error: {message}")

    async def generate_async(self, prompt: str, use_cache: bool = True, max_tokens: Optional[int] = None) -> dict:
        """
        Async version of generate() with one extra saving: if an identical request is
        already being processed, this call waits for that result instead of paying twice.
        """
        key = None
        if use_cache:
            cached = self._cache.get(prompt)
            if cached is not None:
                return cached
            key = self._cache.key(prompt)
            pending = self._inflight.get(key)
            if pending is not None:
                logger.info("Joining identical in-flight request (no extra AI call)")
                return await asyncio.shield(pending)

        task = asyncio.ensure_future(self._call_async(prompt, use_cache, max_tokens))
        if key is not None:
            self._inflight[key] = task
            task.add_done_callback(lambda t, k=key: self._on_done(k, t))
        # shield: if this caller disconnects, the call still completes and fills the cache
        # (the credits are already spent, so the result should not be thrown away).
        return await asyncio.shield(task)

    def _on_done(self, key: str, task: "asyncio.Future") -> None:
        self._inflight.pop(key, None)
        if not task.cancelled():
            task.exception()  # mark retrieved; callers re-raise it themselves

    async def _call_async(self, prompt: str, use_cache: bool, max_tokens: Optional[int]) -> dict:
        start_time = time.time()
        raw_text = ""
        try:
            raw_text = await asyncio.wait_for(
                self._generate_text_async(prompt, max_tokens),
                timeout=AI_REQUEST_TIMEOUT,
            )
            parsed = self._parse_json(raw_text)

            elapsed_ms = round((time.time() - start_time) * 1000)
            logger.info(f"{self.provider} async API call completed in {elapsed_ms}ms (response length: {len(raw_text)} chars)")

            if use_cache:
                self._cache.put(prompt, parsed)

            return parsed
        except BudgetExceeded:
            raise
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e}. Raw response: {raw_text[:500]}")
            raise ValueError(f"Failed to parse model response as JSON: {e}")
        except Exception as e:
            message = str(e) or e.__class__.__name__
            logger.error(f"{self.provider} async API error: {message}")
            raise RuntimeError(f"{self.provider} async API error: {message}")

    def _generate_text(self, prompt: str, max_tokens: Optional[int] = None) -> str:
        limit = self._ceiling(max_tokens)
        self._budget.consume()  # One shared call budget unit per request, regardless of fallback provider.
        last_error = None
        for provider in self.providers:
            started = time.time()
            try:
                if provider == "gemini":
                    response = self.gemini_model.generate_content(
                        prompt, generation_config={"max_output_tokens": limit}
                    )
                    if response.text is None:
                        raise RuntimeError("Gemini returned an empty response")
                    self._log_usage(response, round((time.time() - started) * 1000), "gemini")
                    return response.text.strip()
                response = self.openai_client.chat.completions.create(
                    model=OPENAI_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.1,
                    max_tokens=limit,
                    response_format={"type": "json_object"},
                )
                content = response.choices[0].message.content
                if content is None:
                    raise RuntimeError("OpenAI returned an empty response")
                return content.strip()
            except Exception as error:
                last_error = error
                logger.warning(f"{provider} failed; trying fallback: {error}")
        raise RuntimeError(f"All AI providers failed: {last_error}")

    async def _generate_text_async(self, prompt: str, max_tokens: Optional[int] = None) -> str:
        limit = self._ceiling(max_tokens)
        self._budget.consume()  # One shared call budget unit per request, regardless of fallback provider.
        last_error = None
        for provider in self.providers:
            started = time.time()
            try:
                if provider == "gemini":
                    response = await asyncio.to_thread(
                        self.gemini_model.generate_content,
                        prompt,
                        generation_config={"max_output_tokens": limit},
                    )
                    if response.text is None:
                        raise RuntimeError("Gemini returned an empty response")
                    self._log_usage(response, round((time.time() - started) * 1000), "gemini")
                    return response.text.strip()
                response = await self.openai_async_client.chat.completions.create(
                    model=OPENAI_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.1,
                    max_tokens=limit,
                    response_format={"type": "json_object"},
                )
                content = response.choices[0].message.content
                if content is None:
                    raise RuntimeError("OpenAI returned an empty response")
                return content.strip()
            except Exception as error:
                last_error = error
                logger.warning(f"{provider} failed; trying fallback: {error}")
        raise RuntimeError(f"All AI providers failed: {last_error}")

    @property
    def cache_stats(self) -> dict:
        """Expose cache statistics for the /health endpoint."""
        return self._cache.stats

    @property
    def budget_stats(self) -> dict:
        """Expose daily call-budget usage for the /health endpoint."""
        return self._budget.stats

    def forget(self, prompt: str) -> None:
        """Evict one cached response so a retry makes a fresh call."""
        self._cache.pop(prompt)

    def clear_cache(self) -> None:
        """Clear the response cache."""
        self._cache.clear()

    def _parse_json(self, text: str) -> dict:
        """
        Robust JSON extraction — handles markdown fences and leading/trailing text.
        """
        # Try direct parse first
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Strip markdown code fences
        cleaned = re.sub(r"```(?:json)?\s*", "", text).strip()
        cleaned = re.sub(r"```\s*$", "", cleaned).strip()
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass

        # Extract first JSON object/array
        match = re.search(r"(\{.*\}|\[.*\])", text, re.DOTALL)
        if match:
            return json.loads(match.group(1))

        raise json.JSONDecodeError("No valid JSON found in response", text, 0)


# Singleton instance
gemini_client = GeminiClient()
