"""
Unit tests for LRUCache, JSON parsing resilience, and GeminiClient.
"""
import time
import pytest
from unittest.mock import MagicMock, patch

from gemini_client import LRUCache, GeminiClient


class TestLRUCache:
    def test_cache_put_and_get(self):
        cache = LRUCache(max_size=5, ttl=10)
        cache.put("prompt 1", {"result": "data 1"})
        assert cache.get("prompt 1") == {"result": "data 1"}
        assert cache.stats["hits"] == 1
        assert cache.stats["misses"] == 0

    def test_cache_miss(self):
        cache = LRUCache(max_size=5, ttl=10)
        assert cache.get("nonexistent prompt") is None
        assert cache.stats["misses"] == 1

    def test_cache_ttl_expiration(self):
        cache = LRUCache(max_size=5, ttl=1) # 1 sec TTL
        cache.put("prompt 1", {"result": "data 1"})
        time.sleep(1.1)
        assert cache.get("prompt 1") is None
        assert cache.stats["misses"] == 1

    def test_cache_max_size_eviction(self):
        cache = LRUCache(max_size=2, ttl=60)
        cache.put("p1", {"d": 1})
        cache.put("p2", {"d": 2})
        cache.put("p3", {"d": 3})  # Should evict p1

        assert cache.get("p1") is None
        assert cache.get("p2") == {"d": 2}
        assert cache.get("p3") == {"d": 3}

    def test_cache_clear(self):
        cache = LRUCache(max_size=5, ttl=60)
        cache.put("p1", {"d": 1})
        cache.clear()
        assert cache.stats["size"] == 0
        assert cache.stats["hits"] == 0
        assert cache.stats["misses"] == 0


class TestJsonParsing:
    def setup_method(self):
        self.client = GeminiClient()

    def test_direct_json(self):
        raw = '{"plain_summary": "Test overview", "reading_level": "High School"}'
        result = self.client._parse_json(raw)
        assert result["plain_summary"] == "Test overview"

    def test_markdown_code_fence(self):
        raw = '```json\n{"plain_summary": "Test overview"}\n```'
        result = self.client._parse_json(raw)
        assert result["plain_summary"] == "Test overview"

    def test_leading_and_trailing_text(self):
        raw = 'Here is the response:\n{"plain_summary": "Test overview"}\nHope this helps!'
        result = self.client._parse_json(raw)
        assert result["plain_summary"] == "Test overview"

    def test_invalid_json_raises_error(self):
        raw = "This is not valid JSON at all."
        with pytest.raises(Exception):
            self.client._parse_json(raw)


class TestGeminiClientMocked:
    @patch("google.generativeai.GenerativeModel")
    def test_generate_caching(self, mock_model_cls):
        client = GeminiClient()
        mock_response = MagicMock()
        mock_response.text = '{"status": "ok"}'
        client.model.generate_content = MagicMock(return_value=mock_response)

        # First call -> API miss -> cache put
        res1 = client.generate("test prompt")
        assert res1 == {"status": "ok"}
        assert client.model.generate_content.call_count == 1

        # Second call -> Cache HIT -> no API call
        res2 = client.generate("test prompt")
        assert res2 == {"status": "ok"}
        assert client.model.generate_content.call_count == 1  # Still 1 call!
