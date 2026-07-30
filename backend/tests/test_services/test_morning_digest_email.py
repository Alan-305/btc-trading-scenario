import pytest
import respx
from httpx import Response

from app.config import Settings
from app.services.email_service import send_morning_digest_email
from app.schemas.market import MarketSnapshot
from app.schemas.scenario import (
    EntryZone,
    ExitStrategy,
    ScenarioHorizonBundle,
    ScenarioIndicators,
    ScenarioResponse,
)
from datetime import datetime, timezone


def _sample_scenario() -> ScenarioResponse:
    now = datetime.now(timezone.utc)
    entry = EntryZone(side="long", zone_low=90000, zone_high=91000, rationale="test")
    exit_ = ExitStrategy(take_profit=[95000], stop_loss=88000, rationale="test")
    horizon = ScenarioHorizonBundle(
        id="today",
        label="本日",
        period_hint="24h",
        entry=entry,
        exit=exit_,
        forecast=[],
        scenario_text_ja="テスト用のシナリオ要約です。",
    )
    return ScenarioResponse(
        macro_trend="bullish",
        confidence=0.72,
        entry=entry,
        exit=exit_,
        forecast=[],
        scenario_text_ja="総合的に上昇基調です。",
        horizons=[horizon],
        indicators=ScenarioIndicators(fear_greed=55, funding_rate=0.0001, divergence_max_pct=0.4),
        generated_at=now,
    )


@respx.mock
def test_send_morning_digest_email_success():
    respx.post("https://api.resend.com/emails").mock(
        return_value=Response(200, json={"id": "msg_digest"}),
    )
    settings = Settings(
        resend_api_key="re_test",
        resend_from_email="BTC Scenario <onboarding@resend.dev>",
        app_public_url="https://nexus-btc-trading.web.app",
    )
    snapshot = MarketSnapshot(tickers=[], orderbooks=[], collected_at=datetime.now(timezone.utc))
    send_morning_digest_email(
        to="user@example.com",
        scenario=_sample_scenario(),
        snapshot=snapshot,
        reference_price=90500,
        unsubscribe_token="token-abc",
        settings=settings,
    )
