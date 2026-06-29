import pytest
import respx
from datetime import datetime, timezone
from httpx import Response

from app.config import Settings
from app.llm.gemini_client import GEMINI_API_BASE
from app.llm.scenario_writer import ScenarioWriter
from app.schemas.market import FearGreedIndex, MarketSnapshot
from app.services.scenario_market_context import ScenarioMarketContext


def _writer_context(
    *,
    fear_greed: int | None = 20,
    funding_rate: float | None = 0.0001,
    research_count: int = 0,
) -> ScenarioMarketContext:
    fg = (
        FearGreedIndex(value=fear_greed, classification="Fear", timestamp=datetime.now(timezone.utc))
        if fear_greed is not None
        else None
    )
    from app.schemas.market import CoinglassSnapshot

    cg = (
        CoinglassSnapshot(funding_rate=funding_rate, timestamp=datetime.now(timezone.utc))
        if funding_rate is not None
        else None
    )
    return ScenarioMarketContext(
        snapshot=MarketSnapshot(tickers=[], orderbooks=[], collected_at=datetime.now(timezone.utc)),
        reference_price=100_000,
        fear_greed=fg,
        derivatives=cg,
        technical=None,
        risk_zones=None,
        sessions=None,
        heatmap=None,
        divergence_pct={"binance": 0.2},
        research=[],
    )


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
        market_context=_writer_context(),
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
        market_context=_writer_context(),
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
        market_context=_writer_context(fear_greed=15, funding_rate=0.0),
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
        market_context=_writer_context(fear_greed=60, funding_rate=None),
    )
    assert "上昇" in text


def test_clean_scenario_text_strips_erroneous_man_prefix():
    from app.llm.scenario_writer import _clean_scenario_text

    cleaned = _clean_scenario_text("5万58,504.78ドル台のロング清算が下落を招く可能性があります。")
    assert "5万" not in cleaned
    assert "58,504.78ドル" in cleaned
