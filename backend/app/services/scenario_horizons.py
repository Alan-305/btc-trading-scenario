from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.schemas.scenario import (
    EntryZone,
    ExitStrategy,
    ForecastPoint,
    MacroTrend,
    ScenarioHorizonBundle,
    TradeSide,
)

# 次回ビットコイン半減期の目安（2028年4月頃）
NEXT_BITCOIN_HALVING = datetime(2028, 4, 20, tzinfo=timezone.utc)

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


def _months_until_halving(now: datetime) -> int:
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    delta = NEXT_BITCOIN_HALVING - now
    return max(1, min(24, delta.days // 30))


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


def _horizon_text(
    horizon_id: str,
    macro_trend: MacroTrend,
    side: TradeSide,
    entry_low: float,
    entry_high: float,
    take_profit: list[float],
    stop_loss: float,
    period_hint: str,
    research_count: int = 0,
    session_summary: str | None = None,
) -> str:
    trend = TREND_JA[macro_trend]
    side_ja = SIDE_JA[side]
    tp_text = "、".join(f"{p:,.2f}ドル" for p in take_profit)

    if horizon_id == "today":
        lead = f"本日（{period_hint}）のBTCは{trend}寄り。"
    elif horizon_id == "week":
        lead = f"今週（{period_hint}）の見通しは{trend}寄り。"
    elif horizon_id == "month":
        lead = f"今月（{period_hint}）のスイング視点では{trend}寄り。"
    else:
        lead = f"次の半減期（{period_hint}）までの大局的視点では{trend}寄り。"

    if side == "neutral":
        zone = f"大きな方向性が出るまでは {entry_low:,.2f}ドル〜{entry_high:,.2f}ドル付近の様子見が中心です。"
    else:
        zone = f"{side_ja}想定のエントリー帯は {entry_low:,.2f}ドル〜{entry_high:,.2f}ドル付近です。"

    extra = ""
    if research_count:
        extra += f"登録調査メモ {research_count} 件も方向判断に反映。"
    if session_summary:
        extra += session_summary

    return (
        f"{lead}{zone}"
        f"利確目安 {tp_text}、損切り {stop_loss:,.2f}ドル を想定しています。"
        f"{extra}"
        f"時間軸が長いほど目安の幅は広くなります。必ず自分のルールで判断してください。"
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
) -> list[ScenarioHorizonBundle]:
    halving_months = _months_until_halving(now)
    halving_label = f"{NEXT_BITCOIN_HALVING.year}年{NEXT_BITCOIN_HALVING.month}月頃"

    specs: list[tuple[str, str, str, tuple[float, float, float], int, timedelta, float]] = [
        ("today", "本日のシナリオ", "約6時間", (0.005, 0.02, 0.04, 0.03), 6, timedelta(hours=1), 0.005),
        ("week", "今週のシナリオ", "約7日間", (0.015, 0.05, 0.08, 0.06), 7, timedelta(days=1), 0.008),
        ("month", "今月のシナリオ", "約4週間", (0.03, 0.10, 0.15, 0.10), 4, timedelta(weeks=1), 0.025),
        (
            "halving",
            "次の半減期までのシナリオ",
            f"〜{halving_label}",
            (0.05, 0.25, 0.40, 0.20),
            min(8, halving_months),
            timedelta(days=30),
            0.015,
        ),
    ]

    horizons: list[ScenarioHorizonBundle] = []

    for hid, label, period_hint, scale, steps, step_delta, step_move in specs:
        entry_pct, tp1, tp2, sl_pct = scale
        if hid == "today":
            horizons.append(
                ScenarioHorizonBundle(
                    id=hid,
                    label=label,
                    period_hint=period_hint,
                    entry=today_entry,
                    exit=today_exit,
                    forecast=today_forecast,
                    scenario_text_ja=today_scenario_text,
                )
            )
            continue

        el, eh, tp, sl = _scaled_zones(price, side, entry_pct, (tp1, tp2), sl_pct)
        forecast = _forecast_path(price, macro_trend, now, steps, step_delta, step_move)
        text = _horizon_text(
            hid, macro_trend, side, el, eh, tp, sl, period_hint, research_count, session_summary
        )

        horizons.append(
            ScenarioHorizonBundle(
                id=hid,
                label=label,
                period_hint=period_hint,
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

    return horizons
