"""
Gemini API client wrapper.
Handles model initialization, API calls, JSON extraction, caching, and error handling.
"""
import os
import json
import re
import time
import hashlib
import logging
from collections import OrderedDict
from typing import Optional
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# Configure Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

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
    "max_output_tokens": 8192,
    "response_mime_type": "application/json",  # Force JSON output
}

# ─── LRU Cache with TTL ───────────────────────────────────────────────────────

# Cache configuration
CACHE_MAX_SIZE = int(os.getenv("CACHE_MAX_SIZE", "100"))   # Max cached responses
CACHE_TTL_SECONDS = int(os.getenv("CACHE_TTL", "600"))     # 10 minute TTL


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
        """Generate a deterministic SHA-256 hash for a prompt string."""
        return hashlib.sha256(prompt.encode("utf-8")).hexdigest()

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
        model_name = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
        self.model = genai.GenerativeModel(
            model_name=model_name,
            generation_config=GENERATION_CONFIG,
            safety_settings=SAFETY_SETTINGS,
        )
        self._cache = LRUCache()

    def generate(self, prompt: str, use_cache: bool = True) -> dict:
        """
        Send prompt to Gemini and return parsed JSON response.
        Uses LRU cache to avoid redundant API calls for identical prompts.
        Raises ValueError if response cannot be parsed as JSON.
        """
        # Check cache first
        if use_cache:
            cached = self._cache.get(prompt)
            if cached is not None:
                return cached

        start_time = time.time()
        try:
            response = self.model.generate_content(prompt)
            raw_text = response.text.strip()
            parsed = self._parse_json(raw_text)

            elapsed_ms = round((time.time() - start_time) * 1000)
            logger.info(f"Gemini API call completed in {elapsed_ms}ms (response length: {len(raw_text)} chars)")

            # Cache the successful response
            if use_cache:
                self._cache.put(prompt, parsed)

            return parsed
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e}. Raw response: {raw_text[:500]}")
            raise ValueError(f"Failed to parse model response as JSON: {e}")
        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            raise RuntimeError(f"Gemini API error: {e}")

    async def generate_async(self, prompt: str, use_cache: bool = True) -> dict:
        """
        Async version of generate(). Uses generate_content_async for non-blocking I/O.
        """
        # Check cache first
        if use_cache:
            cached = self._cache.get(prompt)
            if cached is not None:
                return cached

        start_time = time.time()
        try:
            response = await self.model.generate_content_async(prompt)
            raw_text = response.text.strip()
            parsed = self._parse_json(raw_text)

            elapsed_ms = round((time.time() - start_time) * 1000)
            logger.info(f"Gemini async API call completed in {elapsed_ms}ms (response length: {len(raw_text)} chars)")

            if use_cache:
                self._cache.put(prompt, parsed)

            return parsed
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e}. Raw response: {raw_text[:500]}")
            raise ValueError(f"Failed to parse model response as JSON: {e}")
        except Exception as e:
            logger.error(f"Gemini async API error: {e}")
            raise RuntimeError(f"Gemini API error: {e}")

    @property
    def cache_stats(self) -> dict:
        """Expose cache statistics for the /health endpoint."""
        return self._cache.stats

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
