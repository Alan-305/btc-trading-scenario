from datetime import datetime, timezone

from app.schemas.scenario import EntryZone, ExitStrategy, ForecastPoint
from app.services.hold_scenario import build_hold_horizon
from app.services.scenario_horizons import build_scenario_horizons, format_swing_macro_caution


def test_build_scenario_horizons_three_tabs():
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

    assert len(horizons) == 3
    assert [h.id for h in horizons] == ["today", "week", "hodl"]
    assert horizons[0].horizon_mode == "swing"
    assert horizons[2].horizon_mode == "hodl"
    assert horizons[2].hold_context is not None
    assert horizons[2].exit.stop_loss == 0
    assert len(horizons[2].hold_context.peak_targets) == 2


def test_hold_horizon_has_buy_zones_and_peaks():
    now = datetime(2026, 6, 27, tzinfo=timezone.utc)
    h = build_hold_horizon(price=100_000, macro_trend="bullish", now=now, support=92_000)
    assert h.id == "hodl"
    assert len(h.hold_context.buy_zones) == 3
    assert h.hold_context.peak_targets[0].cycle_label == "2028半減期サイクル"
    assert h.hold_context.peak_targets[1].cycle_label == "2032半減期サイクル"


def test_swing_macro_caution_empty_without_events():
    assert format_swing_macro_caution([]) == ""
