from datetime import datetime, timezone

from app.schemas.scenario import EntryZone, ExitStrategy, ForecastPoint
from app.services.scenario_horizons import NEXT_BITCOIN_HALVING, build_scenario_horizons


def test_build_scenario_horizons_four_items():
    now = datetime(2026, 6, 27, tzinfo=timezone.utc)
    entry = EntryZone(side="long", zone_low=99000, zone_high=100000, rationale="test")
    exit = ExitStrategy(take_profit=[102000, 104000], stop_loss=97000, rationale="test")
    forecast = [ForecastPoint(ts=now, price=100500)]

    horizons = build_scenario_horizons(
        price=100000,
        macro_trend="bullish",
        side="long",
        base_entry_rationale="entry",
        base_exit_rationale="exit",
        now=now,
        today_scenario_text="本日テキスト",
        today_entry=entry,
        today_exit=exit,
        today_forecast=forecast,
    )

    assert len(horizons) == 4
    assert horizons[0].id == "today"
    assert horizons[0].scenario_text_ja == "本日テキスト"
    assert horizons[1].id == "week"
    assert horizons[3].id == "halving"
    assert NEXT_BITCOIN_HALVING.year == 2028
