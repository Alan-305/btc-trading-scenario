from app.schemas.extended_market import (
    BtcEtfFlowSnapshot,
    BtcOptionsSnapshot,
    MacroContextSnapshot,
    MacroSeriesPoint,
    OnChainSnapshot,
)
from app.services.macro_analysis import enrich_macro_context
from datetime import datetime, timezone


def _etf(outflow: bool = False, reversal: bool = False) -> BtcEtfFlowSnapshot:
    if outflow and not reversal:
        flows = [-100e6, -80e6, -120e6, -90e6]
    elif reversal:
        flows = [-100e6, -80e6, -60e6, 50e6]
    else:
        flows = [20e6, 30e6, 25e6, 40e6]
    return BtcEtfFlowSnapshot(
        net_flow_3d_usd=sum(flows[-3:]),
        trend="outflow" if outflow and not reversal else "inflow",
        daily_flows=[
            MacroSeriesPoint(ts=datetime(2026, 6, 20 + i, tzinfo=timezone.utc), value=v)
            for i, v in enumerate(flows)
        ],
    )


def _options(high_pc: bool = False) -> BtcOptionsSnapshot:
    return BtcOptionsSnapshot(
        put_open_interest=150000,
        call_open_interest=100000,
        put_call_ratio=1.25 if high_pc else 0.65,
        dvol_index=58 if high_pc else 42,
        dvol_history=[
            MacroSeriesPoint(ts=datetime(2026, 6, 20 + i, tzinfo=timezone.utc), value=v)
            for i, v in enumerate([55, 54, 52, 49, 47])
        ],
    )


def _onchain(falling: bool = False) -> OnChainSnapshot:
    tx = [400000, 390000, 380000, 370000, 410000] if not falling else [420000, 400000, 380000, 360000, 350000]
    return OnChainSnapshot(
        hash_rate_change_7d_pct=-4.0 if falling else 5.0,
        activity_trend="falling" if falling else "rising",
        tx_count_history=[
            MacroSeriesPoint(ts=datetime(2026, 6, 20 + i, tzinfo=timezone.utc), value=v) for i, v in enumerate(tx)
        ],
    )


def test_macro_analysis_etf_outflow_signal():
    snap = enrich_macro_context(MacroContextSnapshot(etf_flows=_etf(outflow=True)))
    assert snap.etf_flows
    assert snap.etf_flows.signal_ja == "下落の症候"
    assert "流出" in snap.etf_flows.summary_ja


def test_macro_analysis_etf_reversal_signal():
    snap = enrich_macro_context(MacroContextSnapshot(etf_flows=_etf(reversal=True)))
    assert snap.etf_flows
    assert snap.etf_flows.signal_ja in ("トレンド転換の兆候", "上昇支援", "様子見")


def test_macro_analysis_options_put_heavy():
    snap = enrich_macro_context(MacroContextSnapshot(options=_options(high_pc=True)))
    assert snap.options
    assert snap.options.signal_ja in ("下落の症候", "不安拡大")
    assert "Put" in snap.options.summary_ja


def test_macro_analysis_overall_summary():
    snap = enrich_macro_context(
        MacroContextSnapshot(
            etf_flows=_etf(outflow=True),
            options=_options(high_pc=True),
            onchain=_onchain(falling=True),
        )
    )
    assert snap.overall_signal_ja == "下落の症候"
    assert snap.overall_summary_ja
    assert "総合" in snap.overall_summary_ja
