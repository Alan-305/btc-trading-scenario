from datetime import datetime, timezone

from app.schemas.extended_market import (
    EquityIndexSnapshot,
    GlobalEquitySnapshot,
    MacroContextSnapshot,
    MacroSeriesPoint,
)
from app.services.macro_analysis import enrich_equity_markets, enrich_macro_context


def _equity(market_id: str, ch1: float, ch5: float) -> EquityIndexSnapshot:
    return EquityIndexSnapshot(
        market_id=market_id,  # type: ignore[arg-type]
        name_ja="test",
        symbol="^TEST",
        last_price=1000,
        change_1d_pct=ch1,
        change_5d_pct=ch5,
        history=[
            MacroSeriesPoint(ts=datetime.now(timezone.utc), value=1000),
            MacroSeriesPoint(ts=datetime.now(timezone.utc), value=1000 + ch1 * 10),
        ],
    )


def test_equity_markets_bearish_when_all_down():
    equity = GlobalEquitySnapshot(
        markets=[
            _equity("us", -2.0, -4.0),
            _equity("japan", -1.8, -3.5),
            _equity("europe", -1.2, -2.0),
        ]
    )
    snap = enrich_macro_context(MacroContextSnapshot(equity_markets=enrich_equity_markets(equity)))
    assert snap.equity_markets is not None
    assert snap.equity_markets.stance in ("bearish", "caution")


def test_equity_markets_in_overall_summary():
    equity = enrich_equity_markets(
        GlobalEquitySnapshot(
            markets=[
                _equity("us", 2.0, 4.0),
                _equity("japan", 1.5, 3.0),
                _equity("europe", 1.0, 2.5),
            ]
        )
    )
    snap = enrich_macro_context(MacroContextSnapshot(equity_markets=equity))
    assert snap.overall_summary_ja
    assert "世界株" in snap.overall_summary_ja
