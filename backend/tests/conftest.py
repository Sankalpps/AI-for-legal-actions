"""
Shared test setup.

* Provides dummy credentials so the suite runs on a clean machine / CI with no .env.
* Guarantees no test can reach a real AI provider (which would spend real credits):
  the module-level client used by the FastAPI app is stubbed to fail loudly if called.
* Resets the rate limiter between tests so they don't interfere with each other.
"""
import os

os.environ.setdefault("GEMINI_API_KEY", "test-key")
os.environ.setdefault("AI_PROVIDER", "gemini")

import pytest


@pytest.fixture(autouse=True)
def _isolate_app_state(monkeypatch):
    import main
    from gemini_client import gemini_client

    def _boom(*args, **kwargs):
        raise AssertionError("A test tried to call a real AI provider. Mock it instead.")

    if gemini_client.gemini_model is not None:
        monkeypatch.setattr(gemini_client.gemini_model, "generate_content", _boom, raising=False)
    monkeypatch.setattr(gemini_client, "openai_client", None)
    monkeypatch.setattr(gemini_client, "openai_async_client", None)

    main.rate_guard._hits.clear()
    monkeypatch.setattr(main.rate_guard, "limit", 1000)
    gemini_client.clear_cache()
    yield
