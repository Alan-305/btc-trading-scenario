from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.schemas.macro_events import MacroEvent
from app.schemas.scenario import (
    EntryZone,
    ExitStrategy,
    ForecastPoint,
    MacroTrend,
    ScenarioHorizonBundle,
    TradeSide,
)
from app.services.hold_scenario import build_hold_horizon

TREND_JA = {
    "bullish": "上昇",
    "bearish": "下降",
    "range": "レンジ",
}

SIDE_JA = {
    "long": "ロング",
    "short": "ショート",
    "neutral": "様子見",
}


def format_swing_macro_caution(events: list[MacroEvent], *, within_hours: int = 48) -> str:
    """High-impact US macro events for swing trade warnings."""
    now = datetime.now(timezone.utc)
    upcoming: list[MacroEvent] = []
    for ev in events:
        if ev.impact != "high" or ev.country != "US":
            continue
        hours = (ev.scheduled_at - now).total_seconds() / 3600
        if -6 <= hours <= within_hours:
            upcoming.append(ev)

    if not upcoming:
        return ""

    upcoming.sort(key=lambda e: e.scheduled_at)
    lines: list[str] = []
    for ev in upcoming[:4]:
        name = ev.name_ja or ev.name
        when = ev.scheduled_at.astimezone(timezone.utc)
        label = when.strftime("%m/%d %H:%M UTC")
        lines.append(f"{name}（{label}）")

    joined = "、".join(lines)
    return (
        f"【経済指標】今後{within_hours}時間以内の高インパクト指標：{joined}。"
        f"スイングでは指標前後の急変動に注意し、無理な新規エントリーは避けてください。"
    )


def _scaled_zones(
    price: float,
    side: TradeSide,
    entry_pct: float,
    tp_pcts: tuple[float, float],
    sl_pct: float,
) -> tuple[float, float, list[float], float]:
    if side == "long":
        entry_low = round(price * (1 - entry_pct), 2)
        entry_high = round(price * (1 + entry_pct * 0.5), 2)
        take_profit = [round(price * (1 + tp_pcts[0]), 2), round(price * (1 + tp_pcts[1]), 2)]
        stop_loss = round(price * (1 - sl_pct), 2)
    elif side == "short":
        entry_low = round(price * (1 - entry_pct * 0.5), 2)
        entry_high = round(price * (1 + entry_pct), 2)
        take_profit = [round(price * (1 - tp_pcts[0]), 2), round(price * (1 - tp_pcts[1]), 2)]
        stop_loss = round(price * (1 + sl_pct), 2)
    else:
        band = entry_pct
        entry_low = round(price * (1 - band), 2)
        entry_high = round(price * (1 + band), 2)
        take_profit = [round(price * (1 + tp_pcts[0] * 0.5), 2)]
        stop_loss = round(price * (1 - sl_pct * 0.5), 2)
    return min(entry_low, entry_high), max(entry_low, entry_high), take_profit, stop_loss


def _forecast_path(
    price: float,
    macro_trend: MacroTrend,
    now: datetime,
    steps: int,
    step_delta: timedelta,
    step_move_pct: float,
) -> list[ForecastPoint]:
    direction = 1 if macro_trend == "bullish" else -1 if macro_trend == "bearish" else 0
    points: list[ForecastPoint] = []
    for i in range(steps):
        move = direction * step_move_pct * (i + 1)
        points.append(
            ForecastPoint(
                ts=now + step_delta * (i + 1),
                price=round(price * (1 + move), 2),
            )
        )
    return points


def _swing_horizon_text(
    horizon_id: str,
    macro_trend: MacroTrend,
    side: TradeSide,
    entry_low: float,
    entry_high: float,
    take_profit: list[float],
    stop_loss: float,
    period_hint: str,
    *,
    research_count: int = 0,
    session_summary: str | None = None,
    macro_caution: str = "",
) -> str:
    trend = TREND_JA[macro_trend]
    side_ja = SIDE_JA[side]
    tp_text = "、".join(f"{p:,.2f}ドル" for p in take_profit)

    if horizon_id == "today":
        lead = f"【スイング・本日】{period_hint}のBTCは{trend}寄り。"
    else:
        lead = f"【スイング・今週】{period_hint}の見通しは{trend}寄り。"

    if side == "neutral":
        zone = f"大きな方向性が出るまでは {entry_low:,.2f}ドル〜{entry_high:,.2f}ドル付近の様子見が中心です。"
    else:
        zone = f"{side_ja}想定のエントリー帯は {entry_low:,.2f}ドル〜{entry_high:,.2f}ドル付近です。"

    extra = ""
    if macro_caution:
        extra += macro_caution
    if research_count:
        extra += f" 登録調査メモ {research_count} 件も方向判断に反映。"
    if session_summary:
        extra += session_summary

    return (
        f"{lead}{zone}"
        f"利確目安 {tp_text}、損切り {stop_loss:,.2f}ドル を想定しています。"
        f"{extra}"
        f"スイングでは経済指標カレンダーの高インパクトイベント前後はボラ拡大に注意してください。"
        f"必ず自分のルールで判断してください。"
    )


def build_scenario_horizons(
    *,
    price: float,
    macro_trend: MacroTrend,
    side: TradeSide,
    base_entry_rationale: str,
    base_exit_rationale: str,
    now: datetime,
    today_scenario_text: str,
    today_entry: EntryZone,
    today_exit: ExitStrategy,
    today_forecast: list[ForecastPoint],
    research_count: int = 0,
    session_summary: str | None = None,
    macro_events: list[MacroEvent] | None = None,
    support: float | None = None,
    research_notes: list[str] | None = None,
) -> list[ScenarioHorizonBundle]:
    macro_caution = format_swing_macro_caution(macro_events or [])
    events = macro_events or []

    swing_specs: list[tuple[str, str, str, tuple[float, float, float], int, timedelta, float]] = [
        ("today", "本日のシナリオ（スイング）", "約6時間", (0.005, 0.02, 0.04, 0.03), 6, timedelta(hours=1), 0.005),
        ("week", "今週のシナリオ（スイング）", "約7日間", (0.015, 0.05, 0.08, 0.06), 7, timedelta(days=1), 0.008),
    ]

    horizons: list[ScenarioHorizonBundle] = []

    for hid, label, period_hint, scale, steps, step_delta, step_move in swing_specs:
        if hid == "today":
            today_text = today_scenario_text
            if macro_caution and macro_caution not in today_text:
                today_text = f"{today_scenario_text}\n\n{macro_caution}"
            horizons.append(
                ScenarioHorizonBundle(
                    id=hid,
                    label=label,
                    period_hint=period_hint,
                    horizon_mode="swing",
                    entry=today_entry,
                    exit=today_exit,
                    forecast=today_forecast,
                    scenario_text_ja=today_text,
                )
            )
            continue

        entry_pct, tp1, tp2, sl_pct = scale
        el, eh, tp, sl = _scaled_zones(price, side, entry_pct, (tp1, tp2), sl_pct)
        forecast = _forecast_path(price, macro_trend, now, steps, step_delta, step_move)
        text = _swing_horizon_text(
            hid,
            macro_trend,
            side,
            el,
            eh,
            tp,
            sl,
            period_hint,
            research_count=research_count,
            session_summary=session_summary,
            macro_caution=macro_caution,
        )

        horizons.append(
            ScenarioHorizonBundle(
                id=hid,  # type: ignore[arg-type]
                label=label,
                period_hint=period_hint,
                horizon_mode="swing",
                entry=EntryZone(
                    side=side,
                    zone_low=el,
                    zone_high=eh,
                    rationale=base_entry_rationale,
                ),
                exit=ExitStrategy(
                    take_profit=tp,
                    stop_loss=sl,
                    rationale=base_exit_rationale,
                ),
                forecast=forecast,
                scenario_text_ja=text,
            )
        )

    horizons.append(
        build_hold_horizon(
            price=price,
            macro_trend=macro_trend,
            now=now,
            support=support,
            research_notes=research_notes,
        )
    )

    return horizons
