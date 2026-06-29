from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.data.btc_halving_cycles import (
    CYCLE_PEAK_PROJECTIONS,
    CYCLE_WINDOW_DAYS,
    CUSTOM_RESEARCH_NOTES,
    last_and_next_halving,
)
from app.schemas.scenario import (
    CyclePeakTarget,
    EntryZone,
    ExitStrategy,
    ForecastPoint,
    HoldBuyZone,
    HoldScenarioContext,
    MacroTrend,
    ScenarioHorizonBundle,
)

_PHASE_BANDS: tuple[tuple[int, int, str], ...] = (
    (0, 180, "半減期直後〜初期上昇局面"),
    (180, CYCLE_WINDOW_DAYS, "半減期後のトレンド立ち上がり局面"),
    (CYCLE_WINDOW_DAYS, CYCLE_WINDOW_DAYS * 2, "サイクル中盤・上昇トレンドが続きやすい局面"),
    (CYCLE_WINDOW_DAYS * 2, CYCLE_WINDOW_DAYS * 3, "サイクル後半・過熱・調整リスクが高まる局面"),
)


def _cycle_phase_ja(days_since_halving: int) -> str:
    for low, high, label in _PHASE_BANDS:
        if low <= days_since_halving < high:
            return label
    return "長期サイクルの後半〜次の半減期に向けた局面"


def _scale_peaks(macro_trend: MacroTrend, factor: float) -> list[CyclePeakTarget]:
    targets: list[CyclePeakTarget] = []
    for spec in CYCLE_PEAK_PROJECTIONS:
        if macro_trend == "bearish":
            low = round(spec.price_low_usd * 0.85 * factor, 0)
            high = round(spec.price_high_usd * 0.85 * factor, 0)
        elif macro_trend == "bullish":
            low = round(spec.price_low_usd * 1.05 * factor, 0)
            high = round(spec.price_high_usd * 1.05 * factor, 0)
        else:
            low = round(spec.price_low_usd * factor, 0)
            high = round(spec.price_high_usd * factor, 0)
        targets.append(
            CyclePeakTarget(
                cycle_label=spec.label_ja,
                peak_window=spec.peak_window_ja,
                price_low=low,
                price_high=high,
                note_ja=spec.basis_ja,
            )
        )
    return targets


def _buy_zones(price: float, support: float | None) -> list[HoldBuyZone]:
    sup = support if support and support > 0 else price * 0.78
    zones = [
        HoldBuyZone(
            label="第1希望（現在付近）",
            zone_low=round(price * 0.93, 2),
            zone_high=round(price * 1.02, 2),
            rationale="押し目・分割DCAの第一候補。急騰追いは避け、時間をかけて積み立てる想定。",
        ),
        HoldBuyZone(
            label="第2希望（調整帯）",
            zone_low=round(min(sup, price * 0.82), 2),
            zone_high=round(price * 0.92, 2),
            rationale="4時間〜日足のサポート付近。過去サイクルでも中間調整で買い増しが有効だった帯。",
        ),
        HoldBuyZone(
            label="第3希望（深い押し）",
            zone_low=round(price * 0.62, 2),
            zone_high=round(price * 0.75, 2),
            rationale="強いリスクオフ時の長期積み増し候補。余裕資金のみ・分割が前提。",
        ),
    ]
    return zones


def _hodl_forecast(
    price: float,
    now: datetime,
    peaks: list[CyclePeakTarget],
) -> list[ForecastPoint]:
    """Long-horizon milestone path through 2032 (schematic, not a price promise)."""
    milestones: list[tuple[datetime, float]] = [(now, price)]
    for i, peak in enumerate(peaks):
        year = 2027 + i * 4
        mid = (peak.price_low + peak.price_high) / 2
        milestones.append(
            (datetime(year, 6, 1, tzinfo=timezone.utc), round(mid, 2)),
        )
    milestones.append((datetime(2032, 4, 1, tzinfo=timezone.utc), round(peaks[-1].price_low * 0.7, 2)))

    return [ForecastPoint(ts=ts, price=p) for ts, p in milestones]


def _hodl_text(
    *,
    price: float,
    macro_trend: MacroTrend,
    phase: str,
    days_since: int,
    days_to_next: int,
    last_label: str,
    next_label: str,
    buy_zones: list[HoldBuyZone],
    peaks: list[CyclePeakTarget],
    research_notes: list[str],
) -> str:
    trend_ja = {"bullish": "上昇", "bearish": "調整", "range": "レンジ"}.get(macro_trend, "レンジ")
    peak_lines = " / ".join(
        f"{p.cycle_label} 参考上値 {p.price_low:,.0f}〜{p.price_high:,.0f}ドル（{p.peak_window}）"
        for p in peaks
    )
    zone_lines = " / ".join(
        f"{z.label} {z.zone_low:,.0f}〜{z.zone_high:,.0f}ドル" for z in buy_zones
    )
    research_block = ""
    if research_notes:
        research_block = "【独自調査メモ】" + " ".join(research_notes) + " "

    return (
        f"ガチホ視点（2032年半減期まで）：{last_label}から{days_since}日経過、"
        f"次の{next_label}まで約{days_to_next}日。"
        f"サイクル上は「{phase}」で、マクロは{trend_ja}寄りの参考です。"
        f"半減期前後±{CYCLE_WINDOW_DAYS}日を1サイクルの目安に、底からピークへの流れを想定しています。"
        f"損切りは設定せず、積み増し帯のみ参考にしてください。"
        f"買い増し候補：{zone_lines}。"
        f"長期の参考上値：{peak_lines}。"
        f"{research_block}"
        f"いずれも過去の傾向とモデルに基づく参考値であり、投資の確約ではありません。"
    )


def build_hold_horizon(
    *,
    price: float,
    macro_trend: MacroTrend,
    now: datetime,
    support: float | None = None,
    research_notes: list[str] | None = None,
) -> ScenarioHorizonBundle:
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    (last_dt, last_label), (next_dt, next_label) = last_and_next_halving(now)
    days_since = max(0, (now - last_dt).days)
    days_to_next = max(1, (next_dt - now).days)
    phase = _cycle_phase_ja(days_since)

    notes = list(CUSTOM_RESEARCH_NOTES)
    if research_notes:
        notes.extend(research_notes)

    buy_zones = _buy_zones(price, support)
    peaks = _scale_peaks(macro_trend, 1.0)
    primary = buy_zones[0]

    hold_context = HoldScenarioContext(
        cycle_phase_ja=phase,
        days_since_halving=days_since,
        days_to_next_halving=days_to_next,
        last_halving_label=last_label,
        next_halving_label=next_label,
        cycle_window_note_ja=(
            f"半減期前後±{CYCLE_WINDOW_DAYS}日を参考に、底打ちからピークまでの流れを想定しています。"
        ),
        buy_zones=buy_zones,
        peak_targets=peaks,
        research_notes=notes,
    )

    period_hint = f"{last_label}後 〜 {next_label}・2032サイクルまで"
    text = _hodl_text(
        price=price,
        macro_trend=macro_trend,
        phase=phase,
        days_since=days_since,
        days_to_next=days_to_next,
        last_label=last_label,
        next_label=next_label,
        buy_zones=buy_zones,
        peaks=peaks,
        research_notes=notes,
    )

    peak_refs = [round((p.price_low + p.price_high) / 2, 2) for p in peaks]

    return ScenarioHorizonBundle(
        id="hodl",
        label="ガチホ（半減期サイクル）",
        period_hint=period_hint,
        horizon_mode="hodl",
        hold_context=hold_context,
        entry=EntryZone(
            side="long",
            zone_low=primary.zone_low,
            zone_high=primary.zone_high,
            rationale="ガチホの第1積み増し帯。損切りではなく分割買いの参考。",
        ),
        exit=ExitStrategy(
            take_profit=peak_refs,
            stop_loss=0,
            rationale="ガチホでは損切りラインは設定しません。上値はサイクルピークの参考レンジです。",
        ),
        forecast=_hodl_forecast(price, now, peaks),
        scenario_text_ja=text,
    )
