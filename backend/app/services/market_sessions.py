from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.schemas.sessions import (
    ActivityLevel,
    ClockDisplay,
    EntryTimingHint,
    ExchangeSessionRole,
    MarketSessionBlock,
    MarketSessionsResponse,
    SessionStatus,
    TimelineHour,
)

JST = ZoneInfo("Asia/Tokyo")
UTC = ZoneInfo("UTC")
EUROPE = ZoneInfo("Europe/Vilnius")  # WhiteBIT 本社付近

WEEKDAY_JA = ["月", "火", "水", "木", "金", "土", "日"]


@dataclass(frozen=True)
class SessionDef:
    id: str
    name_ja: str
    centers_ja: str
    utc_start_hour: int
    utc_end_hour: int
    linked_exchanges: tuple[str, ...]


# 暗号資産の流動性ピーク（UTC 時間帯・おおよそ）
SESSIONS: tuple[SessionDef, ...] = (
    SessionDef("asia", "アジア", "東京・香港", 0, 9, ("bitbank",)),
    SessionDef("europe", "ヨーロッパ", "ロンドン・フランクフルト", 7, 16, ("whitebit",)),
    SessionDef("us", "米国", "ニューヨーク", 13, 22, ()),
)


def _format_clock(dt: datetime, tz: ZoneInfo, label_ja: str, tz_name: str) -> ClockDisplay:
    local = dt.astimezone(tz)
    wd = WEEKDAY_JA[local.weekday()]
    return ClockDisplay(
        timezone=tz_name,
        label_ja=label_ja,
        datetime_iso=local.isoformat(),
        time_hm=local.strftime("%H:%M"),
        weekday_ja=wd,
    )


def _hour_in_session(utc_hour: int, start: int, end: int) -> bool:
    if start <= end:
        return start <= utc_hour < end
    return utc_hour >= start or utc_hour < end


def _active_session_ids(utc_hour: int) -> list[str]:
    return [s.id for s in SESSIONS if _hour_in_session(utc_hour, s.utc_start_hour, s.utc_end_hour)]


def _activity_level(active_count: int) -> ActivityLevel:
    if active_count >= 3:
        return "peak"
    if active_count == 2:
        return "high"
    if active_count == 1:
        return "medium"
    return "low"


def _session_status(now_utc: datetime, start: int, end: int) -> SessionStatus:
    h = now_utc.hour
    if _hour_in_session(h, start, end):
        return "active"
    # simplistic upcoming: next start within 3 hours
    for delta in range(1, 4):
        future_h = (h + delta) % 24
        if future_h == start:
            return "upcoming"
    return "closed"


def _hm_utc_to_jst(utc_hour: int) -> str:
    dt = datetime(2000, 1, 1, utc_hour, 0, tzinfo=UTC)
    return dt.astimezone(JST).strftime("%H:%M")


def _build_timeline(now: datetime) -> list[TimelineHour]:
    now_jst = now.astimezone(JST)
    current_jst_hour = now_jst.hour
    timeline: list[TimelineHour] = []

    for jst_hour in range(24):
        jst_dt = now_jst.replace(hour=jst_hour, minute=0, second=0, microsecond=0)
        utc_hour = jst_dt.astimezone(UTC).hour
        active = _active_session_ids(utc_hour)
        level = _activity_level(len(active))

        # WhiteBIT: 欧州〜米国オーバーラップ（JST 21:00〜翌2:00 付近が特に活発）
        good_wb = "europe" in active or ("europe" in active and "us" in active) or "us" in active
        good_bb = "asia" in active and jst_hour in range(9, 18)

        timeline.append(
            TimelineHour(
                jst_hour=jst_hour,
                jst_label=f"{jst_hour:02d}:00",
                activity_level=level,
                active_sessions=active,
                is_now=jst_hour == current_jst_hour,
                good_for_whitebit=good_wb and level in ("medium", "high", "peak"),
                good_for_bitbank=good_bb,
            )
        )
    return timeline


def _next_high_activity_jst(now: datetime, timeline: list[TimelineHour]) -> str | None:
    now_jst = now.astimezone(JST)
    current = now_jst.hour
    for offset in range(1, 25):
        h = (current + offset) % 24
        cell = timeline[h]
        if cell.activity_level in ("high", "peak"):
            return f"{cell.jst_label}（{', '.join(cell.active_sessions)}）"
    return None


def _entry_hint(now: datetime, timeline: list[TimelineHour]) -> EntryTimingHint:
    now_jst = now.astimezone(JST)
    cell = timeline[now_jst.hour]
    sessions_ja = {"asia": "アジア", "europe": "欧州", "us": "米国"}

    if cell.good_for_whitebit and cell.activity_level in ("high", "peak"):
        summary = "今は WhiteBIT でのエントリー検討に向いている時間帯です。"
        detail = (
            f"欧州・米国セッションが重なり流動性が高いです（{now_jst.strftime('%H:%M')} JST）。"
            f"スイングの新規エントリーは、この時間帯の指値・板の厚みを確認してからがおすすめです。"
        )
    elif cell.good_for_bitbank:
        summary = "bitbank（円建て）の参考価格が信頼しやすい時間帯です。"
        detail = (
            f"アジア時間帯（{now_jst.strftime('%H:%M')} JST）です。"
            f"WhiteBIT でのエントリー判断には bitbank の円建て乖離も参考にしてください。"
        )
    elif cell.activity_level == "low":
        nxt = _next_high_activity_jst(now, timeline)
        summary = "流動性が低めの時間帯です。新規エントリーは控えめに。"
        detail = (
            f"スイングでは無理に入らず、次の活発な時間帯（{nxt or '欧州オープン付近'}）まで待つのが安全です。"
        )
    else:
        active_names = "・".join(sessions_ja.get(s, s) for s in cell.active_sessions) or "オフピーク"
        summary = "どちらかのセッションが動いています。急がずシナリオと板を確認してください。"
        detail = (
            f"現在 {active_names} 時間帯（{now_jst.strftime('%H:%M')} JST）。"
            f"WhiteBIT は欧州以降、bitbank は日中がそれぞれ参考になりやすいです。"
        )

    return EntryTimingHint(
        summary_ja=summary,
        detail_ja=detail,
        next_high_activity_jst=_next_high_activity_jst(now, timeline),
    )


class MarketSessionsService:
    def build(self, now: datetime | None = None) -> MarketSessionsResponse:
        now = now or datetime.now(timezone.utc)
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)

        clocks = [
            _format_clock(now, JST, "日本時間", "Asia/Tokyo"),
            _format_clock(now, UTC, "UTC（世界標準）", "UTC"),
            _format_clock(now, EUROPE, "欧州時間（WhiteBIT）", "Europe/Vilnius"),
        ]

        sessions: list[MarketSessionBlock] = []
        for s in SESSIONS:
            active_now = _active_session_ids(now.hour)
            overlaps = [x for x in active_now if x != s.id and x in [d.id for d in SESSIONS]]
            sessions.append(
                MarketSessionBlock(
                    id=s.id,
                    name_ja=s.name_ja,
                    centers_ja=s.centers_ja,
                    utc_start_hm=f"{s.utc_start_hour:02d}:00",
                    utc_end_hm=f"{s.utc_end_hour:02d}:00",
                    jst_start_hm=_hm_utc_to_jst(s.utc_start_hour),
                    jst_end_hm=_hm_utc_to_jst(s.utc_end_hour),
                    status=_session_status(now, s.utc_start_hour, s.utc_end_hour),
                    activity_level=_activity_level(len(active_now)) if s.id in active_now else "low",
                    overlap_with=overlaps if s.id in active_now else [],
                    linked_exchanges=list(s.linked_exchanges),
                )
            )

        timeline = _build_timeline(now)

        exchanges = [
            ExchangeSessionRole(
                exchange="whitebit",
                name_ja="WhiteBIT",
                primary_session_id="europe",
                note_ja="欧州〜米国時間帯（JST 夕方〜深夜）に流動性・価格発見が活発になりやすい。",
            ),
            ExchangeSessionRole(
                exchange="bitbank",
                name_ja="bitbank",
                primary_session_id="asia",
                note_ja="日本の日中（JST 9:00〜17:00 付近）に円建ての参考価格として有効。",
            ),
        ]

        return MarketSessionsResponse(
            clocks=clocks,
            sessions=sessions,
            timeline_jst=timeline,
            exchanges=exchanges,
            entry_hint=_entry_hint(now, timeline),
            generated_at=now,
        )
