from __future__ import annotations

from dataclasses import dataclass

import httpx
import structlog

logger = structlog.get_logger()

DEFAULT_GEMINI_MODELS = (
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.5-flash-lite",
)

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

    async def generate_text(self, prompt: str, *, temperature: float = 0.35) -> GeminiGenerateResult:
        errors: list[str] = []
        async with httpx.AsyncClient(timeout=60.0) as client:
            for model in self.models:
                url = f"{GEMINI_API_BASE}/models/{model}:generateContent"
                try:
                    response = await client.post(
                        url,
                        params={"key": self.api_key},
                        json={
                            "contents": [{"parts": [{"text": prompt}]}],
                            "generationConfig": _generation_config(model, temperature),
                        },
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


def _generation_config(model: str, temperature: float) -> dict:
    config: dict = {
        "temperature": temperature,
        "topP": 0.9,
        "maxOutputTokens": 2048,
    }
    if "2.5" in model or "3." in model:
        config["thinkingConfig"] = {"thinkingBudget": 0}
    return config


def _extract_result(payload: dict, model: str) -> GeminiGenerateResult:
    candidates = payload.get("candidates") or []
    if not candidates:
        return GeminiGenerateResult(text="", finish_reason=None, model=model)
    candidate = candidates[0]
    parts = candidate.get("content", {}).get("parts") or []
    chunks = [part.get("text", "") for part in parts if isinstance(part, dict)]
    return GeminiGenerateResult(
        text="".join(chunks).strip(),
        finish_reason=candidate.get("finishReason"),
        model=model,
    )
