import pytest
import respx
from httpx import Response

from app.config import Settings
from app.llm.gemini_client import GEMINI_API_BASE
from app.llm.scenario_writer import ScenarioWriter


@pytest.mark.asyncio
async def test_scenario_writer_uses_template_without_api_key():
    writer = ScenarioWriter(Settings(gemini_api_key=""))
    text = await writer.generate(
        macro_trend="range",
        confidence=0.5,
        side="neutral",
        reference_price=100_000,
        entry_low=99_500,
        entry_high=100_500,
        take_profit=[101_000],
        stop_loss=99_000,
        fear_greed=20,
        funding_rate=0.0001,
        divergence_max_pct=0.2,
    )
    assert "本日のBTCは" in text
    assert "99,500" in text


@pytest.mark.asyncio
@respx.mock
async def test_scenario_writer_uses_gemini_when_configured():
    route = respx.post(f"{GEMINI_API_BASE}/models/gemini-2.5-flash:generateContent").mock(
        return_value=Response(
            200,
            json={
                "candidates": [
                    {
                        "finishReason": "STOP",
                        "content": {
                            "parts": [
                                {
                                    "text": (
                                        "BTCはレンジ寄りです。恐怖・強欲指数は20です。"
                                        "エントリーは99,500〜100,500付近を意識してください。"
                                        "利確は101,000、損切りは99,000を想定しています。"
                                        "自分のルールで判断してください。"
                                    )
                                }
                            ]
                        },
                    }
                ]
            },
        )
    )

    writer = ScenarioWriter(Settings(gemini_api_key="test-key", llm_provider="gemini"))
    text = await writer.generate(
        macro_trend="range",
        confidence=0.5,
        side="neutral",
        reference_price=100_000,
        entry_low=99_500,
        entry_high=100_500,
        take_profit=[101_000],
        stop_loss=99_000,
        fear_greed=20,
        funding_rate=0.0001,
        divergence_max_pct=0.2,
    )

    assert route.called
    assert "レンジ寄り" in text


@pytest.mark.asyncio
@respx.mock
async def test_scenario_writer_falls_back_when_gemini_output_incomplete():
    respx.post(f"{GEMINI_API_BASE}/models/gemini-2.5-flash:generateContent").mock(
        return_value=Response(
            200,
            json={
                "candidates": [
                    {
                        "finishReason": "MAX_TOKENS",
                        "content": {
                            "parts": [{"text": "現在のBTCは、60363.14ドル付近で動いており、相"}]
                        },
                    }
                ]
            },
        )
    )

    writer = ScenarioWriter(Settings(gemini_api_key="test-key", llm_provider="gemini"))
    text = await writer.generate(
        macro_trend="range",
        confidence=0.35,
        side="neutral",
        reference_price=60_363,
        entry_low=59_900,
        entry_high=60_500,
        take_profit=[61_000],
        stop_loss=59_000,
        fear_greed=15,
        funding_rate=0.0,
        divergence_max_pct=0.1,
    )
    assert "本日のBTCは" in text
    assert "59,900" in text


@pytest.mark.asyncio
@respx.mock
async def test_scenario_writer_falls_back_when_gemini_fails():
    respx.post(f"{GEMINI_API_BASE}/models/gemini-2.5-flash:generateContent").mock(
        return_value=Response(500, text="error")
    )
    respx.post(f"{GEMINI_API_BASE}/models/gemini-2.0-flash:generateContent").mock(
        return_value=Response(500, text="error")
    )
    respx.post(f"{GEMINI_API_BASE}/models/gemini-2.5-flash-lite:generateContent").mock(
        return_value=Response(500, text="error")
    )

    writer = ScenarioWriter(
        Settings(
            gemini_api_key="test-key",
            llm_provider="gemini",
            gemini_model_fallbacks="",
        )
    )
    text = await writer.generate(
        macro_trend="bullish",
        confidence=0.6,
        side="long",
        reference_price=100_000,
        entry_low=99_500,
        entry_high=100_500,
        take_profit=[102_000, 104_000],
        stop_loss=97_000,
        fear_greed=60,
        funding_rate=None,
        divergence_max_pct=None,
    )
    assert "上昇" in text
