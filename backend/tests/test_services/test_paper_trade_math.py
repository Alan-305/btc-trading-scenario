from app.services.paper_trade_math import PaperTradeState, resolve_paper_trade_exit


def _trade(**kwargs) -> PaperTradeState:
    base = {
        "side": "long",
        "status": "open",
        "entry_price": 60_000.0,
        "size_btc": 0.1,
        "stop_loss": 58_000.0,
        "take_profit1": 62_000.0,
        "take_profit2": 65_000.0,
        "take_profit_target": "tp1",
    }
    base.update(kwargs)
    return PaperTradeState(**base)


def test_long_tp1_target_ignores_tp2():
    resolution = resolve_paper_trade_exit(_trade(take_profit_target="tp1"), 66_000.0)
    assert resolution is not None
    assert resolution.status == "closed_tp1"
    assert resolution.exit_price == 62_000.0


def test_long_tp2_target_requires_tp2():
    resolution = resolve_paper_trade_exit(_trade(take_profit_target="tp2"), 63_000.0)
    assert resolution is None
    resolution = resolve_paper_trade_exit(_trade(take_profit_target="tp2"), 65_000.0)
    assert resolution is not None
    assert resolution.status == "closed_tp2"


def test_long_sl_before_tp():
    resolution = resolve_paper_trade_exit(_trade(), 57_000.0)
    assert resolution is not None
    assert resolution.status == "closed_sl"
