"""Long/short ratio stance for dashboard badges and scenario scoring."""

from __future__ import annotations

from typing import Literal

MacroStance = Literal["bullish", "bearish", "neutral", "caution"]
LongShortSignal = Literal[
    "overheated_long",
    "overheated_short",
    "divergence",
    "rapid_change",
    "neutral",
]

EXTREME_HIGH = 1.2
EXTREME_LOW = 0.85
MILD_HIGH = 1.15
MILD_LOW = 0.95
RAPID_CHANGE = 0.15


def analyze_long_short(
    account_ratio: float | None,
    position_ratio: float | None,
    top_trader_ratio: float | None,
    change_24h: float | None,
    funding_rate: float | None = None,
) -> tuple[LongShortSignal, str, str, MacroStance]:
    """Return (signal, signal_ja, summary_ja, stance). Contrarian on crowding."""
    primary = position_ratio if position_ratio is not None else account_ratio
    parts: list[str] = []

    if account_ratio is not None:
        parts.append(f"一般口座L/S {account_ratio:.2f}")
    if position_ratio is not None:
        parts.append(f"建玉L/S {position_ratio:.2f}")
    if top_trader_ratio is not None:
        parts.append(f"大口L/S {top_trader_ratio:.2f}")
    if change_24h is not None:
        direction = "増" if change_24h > 0 else "減"
        parts.append(f"24hで{abs(change_24h):.2f}{direction}")

    retail_long = (account_ratio is not None and account_ratio >= MILD_HIGH) or (
        position_ratio is not None and position_ratio >= MILD_HIGH
    )
    retail_short = (account_ratio is not None and account_ratio <= MILD_LOW) or (
        position_ratio is not None and position_ratio <= MILD_LOW
    )
    top_long = top_trader_ratio is not None and top_trader_ratio >= MILD_HIGH
    top_short = top_trader_ratio is not None and top_trader_ratio <= MILD_LOW
    diverged = (retail_long and top_short) or (retail_short and top_long)

    if diverged:
        summary = "。".join(parts) + "。一般と大口の向きが逆で、様子見が無難です。"
        return "divergence", "様子見", summary, "caution"

    if change_24h is not None and abs(change_24h) >= RAPID_CHANGE:
        summary = "。".join(parts) + "。偏りが急変しており、様子見が無難です。"
        return "rapid_change", "様子見", summary, "caution"

    extreme_long = (primary is not None and primary >= EXTREME_HIGH) or (
        account_ratio is not None and account_ratio >= EXTREME_HIGH
    )
    extreme_short = (primary is not None and primary <= EXTREME_LOW) or (
        account_ratio is not None and account_ratio <= EXTREME_LOW
    )

    funding_hot_long = funding_rate is not None and funding_rate > 0.0003
    funding_hot_short = funding_rate is not None and funding_rate < -0.0001

    if extreme_long or (retail_long and funding_hot_long):
        summary = "。".join(parts) + "。ロング偏りで調整圧力が意識されます。"
        return "overheated_long", "下落の症候", summary, "bearish"

    if extreme_short or (retail_short and funding_hot_short):
        summary = "。".join(parts) + "。ショート偏りでショートカバーが起きやすいです。"
        return "overheated_short", "上昇支援", summary, "bullish"

    if retail_long:
        summary = "。".join(parts) + "。ややロング寄りです。"
        return "overheated_long", "様子見", summary, "caution"

    if retail_short:
        summary = "。".join(parts) + "。ややショート寄りです。"
        return "overheated_short", "様子見", summary, "caution"

    if not parts:
        return "neutral", "様子見", "ロング／ショート比率のデータがありません。", "neutral"

    summary = "。".join(parts) + "。大きな偏りはありません。"
    return "neutral", "様子見", summary, "neutral"


def score_long_short_contrarian(
    account_ratio: float | None,
    position_ratio: float | None,
    top_trader_ratio: float | None,
    change_24h: float | None,
    funding_rate: float | None = None,
) -> tuple[int, int]:
    """Return (bullish_delta, bearish_delta) capped at 2 each side."""
    signal, _, _, _ = analyze_long_short(
        account_ratio,
        position_ratio,
        top_trader_ratio,
        change_24h,
        funding_rate,
    )
    bullish = 0
    bearish = 0

    primary = position_ratio if position_ratio is not None else account_ratio
    if primary is not None:
        if primary > MILD_HIGH:
            bearish += 1
        elif primary < EXTREME_LOW:
            bullish += 1

    if change_24h is not None and abs(change_24h) >= RAPID_CHANGE:
        if change_24h > 0:
            bearish += 1
        else:
            bullish += 1

    if signal == "divergence" and top_trader_ratio is not None:
        if top_trader_ratio >= MILD_HIGH:
            bullish += 1
        elif top_trader_ratio <= MILD_LOW:
            bearish += 1

    if signal == "overheated_long" and funding_rate is not None and funding_rate > 0.0003:
        bearish += 1
    if signal == "overheated_short" and funding_rate is not None and funding_rate < -0.0001:
        bullish += 1

    return min(2, bullish), min(2, bearish)
