from __future__ import annotations

from dataclasses import dataclass

import httpx
import structlog

logger = structlog.get_logger()

DEFAULT_GEMINI_MODELS = (
    "gemini-3.6-flash",
    "gemini-3.1-flash",
)

# maxOutputTokens includes thinking tokens. Low thinking still uses part of
# this budget, so the cap stays well above a short scenario or summary.
MAX_OUTPUT_TOKENS = 16384

GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"


class GeminiClientError(Exception):
    pass


@dataclass(frozen=True)
class GeminiGenerateResult:
    text: str
    finish_reason: str | None
    model: str

    @property
    def truncated(self) -> bool:
        return self.finish_reason == "MAX_TOKENS"


class GeminiClient:
    def __init__(self, api_key: str, models: tuple[str, ...] = DEFAULT_GEMINI_MODELS):
        self.api_key = api_key.strip()
        self.models = models
        if not self.api_key:
            raise GeminiClientError("GEMINI_API_KEY is empty")

    async def generate_text(
        self,
        prompt: str,
        *,
        system_instruction: str | None = None,
    ) -> GeminiGenerateResult:
        errors: list[str] = []
        body: dict = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": _generation_config(),
        }
        instruction = (system_instruction or "").strip()
        if instruction:
            body["systemInstruction"] = {"parts": [{"text": instruction}]}
        async with httpx.AsyncClient(timeout=60.0) as client:
            for model in self.models:
                url = f"{GEMINI_API_BASE}/models/{model}:generateContent"
                try:
                    response = await client.post(
                        url,
                        params={"key": self.api_key},
                        json=body,
                    )
                    response.raise_for_status()
                    result = _extract_result(response.json(), model)
                    if result.text:
                        return result
                    errors.append(f"{model}: empty response")
                except httpx.HTTPStatusError as exc:
                    detail = exc.response.text[:200]
                    errors.append(f"{model}: HTTP {exc.response.status_code} {detail}")
                except Exception as exc:  # noqa: BLE001
                    errors.append(f"{model}: {exc}")

        raise GeminiClientError("; ".join(errors))


def _generation_config() -> dict:
    return {
        "maxOutputTokens": MAX_OUTPUT_TOKENS,
        "thinkingConfig": {"thinkingLevel": "low"},
    }


def _extract_result(payload: dict, model: str) -> GeminiGenerateResult:
    candidates = payload.get("candidates") or []
    if not candidates:
        return GeminiGenerateResult(text="", finish_reason=None, model=model)
    candidate = candidates[0]
    parts = candidate.get("content", {}).get("parts") or []
    chunks = [
        part.get("text", "")
        for part in parts
        if isinstance(part, dict) and not part.get("thought")
    ]
    return GeminiGenerateResult(
        text="".join(chunks).strip(),
        finish_reason=candidate.get("finishReason"),
        model=model,
    )
