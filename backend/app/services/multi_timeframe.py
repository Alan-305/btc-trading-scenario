from __future__ import annotations

from app.schemas.candles import Candle, CandleInterval, TechnicalAnalysisResponse
from app.schemas.mtf import MtfAnalysis, MtfEntryGate, MtfTimeframeLayer, MtfTrend
from app.schemas.scenario import TradeSide
from app.services.technical_analysis import TechnicalAnalysisService, _swing_levels

_INTERVAL_LABELS: dict[CandleInterval, str] = {
    "1w": "週足",
    "1d": "日足",
    "4h": "4時間足",
    "1h": "1時間足",
}

_SWING_LOOKBACK: dict[CandleInterval, int] = {
    "1w": 52,
    "1d": 60,
    "4h": 20,
    "1h": 48,
}

_TREND_JA = {"bullish": "上昇", "bearish": "下降", "range": "レンジ"}


def _normalize_trend(trend: str) -> MtfTrend:
    if trend == "bullish":
        return "bullish"
    if trend == "bearish":
        return "bearish"
    return "range"


def _trend_conflicts(trend: MtfTrend, side: TradeSide) -> bool:
    if side == "long":
        return trend == "bearish"
    if side == "short":
        return trend == "bullish"
    return False


def _trend_aligns(trend: MtfTrend, side: TradeSide) -> bool:
    if side == "long":
        return trend == "bullish"
    if side == "short":
        return trend == "bearish"
    return False


def _layer_from_ta(
    interval: CandleInterval,
    ta: TechnicalAnalysisResponse,
    candles: list[Candle],
) -> MtfTimeframeLayer:
    lookback = min(_SWING_LOOKBACK.get(interval, 20), max(1, len(candles) - 1))
    support, resistance = _swing_levels(candles, lookback=lookback)
    if support is not None:
        support = round(support, 2)
    if resistance is not None:
        resistance = round(resistance, 2)

    trend = _normalize_trend(ta.trend)
    parts = [_TREND_JA[trend]]
    if support and resistance:
        parts.append(f"サポ ${support:,.0f} / レジ ${resistance:,.0f}")
    if interval == "1h" and ta.stoch_last_cross:
        parts.append("GC" if ta.stoch_last_cross == "gc" else "DC")

    return MtfTimeframeLayer(
        interval=interval,  # type: ignore[arg-type]
        label_ja=_INTERVAL_LABELS[interval],
        trend=trend,
        support=support if support else ta.support,
        resistance=resistance if resistance else ta.resistance,
        stoch_last_cross=ta.stoch_last_cross,
        stoch_zone=ta.stoch_zone,
        summary_ja="・".join(parts),
    )


def build_mtf_analysis(
    analyses: dict[CandleInterval, tuple[list[Candle], TechnicalAnalysisResponse]],
) -> MtfAnalysis:
    service = TechnicalAnalysisService()
    layers: list[MtfTimeframeLayer] = []
    order: list[CandleInterval] = ["1w", "1d", "4h", "1h"]

    for interval in order:
        bundle = analyses.get(interval)
        if not bundle:
            continue
        candles, ta = bundle
        if not candles:
            ta = service.analyze([], interval=interval)
        layers.append(_layer_from_ta(interval, ta, candles))

    if not layers:
        return MtfAnalysis(summary_ja="マルチタイムフレーム分析のデータが不足しています。")

    trend_line = " → ".join(f"{layer.label_ja}{_TREND_JA[layer.trend]}" for layer in layers)
    summary = f"MTF: {trend_line}（週足→日足→4H→1H）"
    return MtfAnalysis(layers=layers, summary_ja=summary)


def layer_by_interval(analysis: MtfAnalysis) -> dict[str, MtfTimeframeLayer]:
    return {layer.interval: layer for layer in analysis.layers}


def evaluate_mtf_entry_gate(
    side: TradeSide,
    price: float,
    analysis: MtfAnalysis | None,
) -> MtfEntryGate | None:
    if not analysis or not analysis.layers or side == "neutral" or price <= 0:
        return None

    layers = layer_by_interval(analysis)
    weekly = layers.get("1w")
    daily = layers.get("1d")
    hourly = layers.get("1h")

    weekly_conflicts = weekly is not None and _trend_conflicts(weekly.trend, side)
    daily_conflicts = daily is not None and _trend_conflicts(daily.trend, side)
    entry_blocked = weekly_conflicts or daily_conflicts

    weekly_aligns = weekly is not None and _trend_aligns(weekly.trend, side)
    daily_aligns = daily is not None and _trend_aligns(daily.trend, side)
    htf_aligned = weekly_aligns and daily_aligns

    near_htf_barrier = False
    caution_parts: list[str] = []
    if side == "long" and weekly and weekly.resistance:
        if price >= weekly.resistance * 0.985:
            near_htf_barrier = True
            caution_parts.append(f"週足レジスタンス ${weekly.resistance:,.0f} 付近")
    elif side == "short" and weekly and weekly.support:
        if price <= weekly.support * 1.015:
            near_htf_barrier = True
            caution_parts.append(f"週足サポート ${weekly.support:,.0f} 付近")

    entry_timing_ready = _entry_timing_ready(side, hourly)

    gate_parts: list[str] = []
    if entry_blocked:
        conflicts = []
        if weekly_conflicts:
            conflicts.append("週足")
        if daily_conflicts:
            conflicts.append("日足")
        gate_parts.append(f"{'・'.join(conflicts)}が{('ロング' if side == 'long' else 'ショート')}と逆方向")
    elif htf_aligned:
        gate_parts.append("週足・日足が方向一致")
    else:
        gate_parts.append("上位足は中立〜一部一致")

    if entry_timing_ready:
        gate_parts.append("1時間足のタイミング条件を満たす")
    else:
        gate_parts.append("1時間足の確認待ち")

    caution_ja = "。".join(caution_parts) + "。" if caution_parts else None
    if near_htf_barrier and caution_ja is None:
        caution_ja = caution_parts[0] + "。" if caution_parts else None

    return MtfEntryGate(
        side=side,
        htf_aligned=htf_aligned,
        entry_blocked=entry_blocked,
        entry_timing_ready=entry_timing_ready,
        near_htf_barrier=near_htf_barrier,
        gate_summary_ja="。".join(gate_parts) + "。",
        caution_ja=caution_ja,
    )


def _entry_timing_ready(side: TradeSide, hourly: MtfTimeframeLayer | None) -> bool:
    if hourly is None:
        return True

    if side == "long":
        if hourly.stoch_last_cross == "gc":
            return True
        if hourly.stoch_zone == "oversold":
            return True
        if hourly.trend == "bullish":
            return True
        return hourly.trend == "range"

    if side == "short":
        if hourly.stoch_last_cross == "dc":
            return True
        if hourly.stoch_zone == "overbought":
            return True
        if hourly.trend == "bearish":
            return True
        return hourly.trend == "range"

    return False


def mtf_score_adjustment(gate: MtfEntryGate | None) -> tuple[int, int]:
    """Return (bullish_delta, bearish_delta) for inference scoring."""
    if gate is None:
        return 0, 0

    bullish_delta = 0
    bearish_delta = 0

    if gate.side == "long":
        if gate.htf_aligned:
            bullish_delta += 2
        if gate.entry_blocked:
            bearish_delta += 2
        if gate.entry_timing_ready:
            bullish_delta += 1
        if gate.near_htf_barrier:
            bearish_delta += 1
    elif gate.side == "short":
        if gate.htf_aligned:
            bearish_delta += 2
        if gate.entry_blocked:
            bullish_delta += 2
        if gate.entry_timing_ready:
            bearish_delta += 1
        if gate.near_htf_barrier:
            bullish_delta += 1

    return bullish_delta, bearish_delta
