"""
Gemini API client wrapper.
Handles model initialization, API calls, JSON extraction, and error handling.
"""
import os
import json
import re
import logging
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


class GeminiClient:
    def __init__(self):
        model_name = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
        self.model = genai.GenerativeModel(
            model_name=model_name,
            generation_config=GENERATION_CONFIG,
            safety_settings=SAFETY_SETTINGS,
        )

    def generate(self, prompt: str) -> dict:
        """
        Send prompt to Gemini and return parsed JSON response.
        Raises ValueError if response cannot be parsed as JSON.
        """
        try:
            response = self.model.generate_content(prompt)
            raw_text = response.text.strip()
            return self._parse_json(raw_text)
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e}. Raw response: {raw_text[:500]}")
            raise ValueError(f"Failed to parse model response as JSON: {e}")
        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            raise RuntimeError(f"Gemini API error: {e}")

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
