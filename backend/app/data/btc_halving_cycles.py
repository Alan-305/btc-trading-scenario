"""Bitcoin halving cycle reference data — edit for your own research."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

# 半減期前後の底・ピーク帯の参考日数（一般的な4年サイクル議論）
CYCLE_WINDOW_DAYS = 500

HALVING_DATES_UTC: tuple[tuple[str, str], ...] = (
    ("2020-05-11", "第3次半減期"),
    ("2024-04-20", "第4次半減期"),
    ("2028-04-20", "第5次半減期（予想）"),
    ("2032-04-20", "第6次半減期（予想）"),
)


@dataclass(frozen=True)
class CyclePeakProjection:
    """参考のサイクルピークレンジ（独自調査で更新してください）."""

    cycle_id: str
    label_ja: str
    peak_window_ja: str
    price_low_usd: float
    price_high_usd: float
    basis_ja: str


# 2028・2032半減期サイクルまでの上値参考レンジ
CYCLE_PEAK_PROJECTIONS: tuple[CyclePeakProjection, ...] = (
    CyclePeakProjection(
        cycle_id="2028",
        label_ja="2028半減期サイクル",
        peak_window_ja="2027年後半〜2028年前半（半減期±500日の参考帯）",
        price_low_usd=140_000,
        price_high_usd=220_000,
        basis_ja=(
            "2024年半減期後の第5サイクル。過去2回の半減期後はおおむね12〜18か月でピーク圏に到達。"
            "ETF需要・機関参入を織り込んだ参考レンジ（確約ではありません）。"
        ),
    ),
    CyclePeakProjection(
        cycle_id="2032",
        label_ja="2032半減期サイクル",
        peak_window_ja="2031年後半〜2032年前半",
        price_low_usd=250_000,
        price_high_usd=450_000,
        basis_ja=(
            "第6サイクル。サイクルごとの上昇率逓減を仮定した長期参考。"
            "マクロ・規制環境で大きく変動し得ます。"
        ),
    ),
)

# 独自調査メモ — 調査結果をここに追記するとガチホシナリオ本文に反映されます
CUSTOM_RESEARCH_NOTES: tuple[str, ...] = (
    # 例: "オンチェーン MVRV が過去サイクル底付近 — 積み増し余地あり",
)


def halving_datetime(date_str: str) -> datetime:
    return datetime.fromisoformat(f"{date_str}T00:00:00").replace(tzinfo=timezone.utc)


def last_and_next_halving(now: datetime) -> tuple[tuple[datetime, str], tuple[datetime, str]]:
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    parsed = [(halving_datetime(d), label) for d, label in HALVING_DATES_UTC]
    last_pair = parsed[0]
    next_pair = parsed[-1]
    for i, (dt, label) in enumerate(parsed):
        if dt <= now:
            last_pair = (dt, label)
            if i + 1 < len(parsed):
                next_pair = parsed[i + 1]
    return last_pair, next_pair
