export type ActivityLevel = "low" | "medium" | "high" | "peak";
export type SessionStatus = "active" | "upcoming" | "closed";
export type MarketStatusCode = "open" | "weekend" | "holiday" | "off_hours";
export type DayType = "weekday" | "weekend" | "holiday";

export interface ClockDisplay {
  timezone: string;
  label_ja: string;
  datetime_iso: string;
  time_hm: string;
  weekday_ja: string;
  day_type: DayType;
  market_note_ja: string | null;
}

export interface MarketSessionBlock {
  id: string;
  name_ja: string;
  centers_ja: string;
  utc_start_hm: string;
  utc_end_hm: string;
  jst_start_hm: string;
  jst_end_hm: string;
  status: SessionStatus;
  activity_level: ActivityLevel;
  stock_market_status: MarketStatusCode;
  stock_market_note_ja: string | null;
  overlap_with: string[];
  linked_exchanges: string[];
}

export interface MarketHourState {
  market_id: string;
  name_ja: string;
  status: MarketStatusCode;
}

export interface TimelineHour {
  jst_hour: number;
  jst_label: string;
  activity_level: ActivityLevel;
  active_sessions: string[];
  is_now: boolean;
  good_for_whitebit: boolean;
  good_for_bitbank: boolean;
  markets: MarketHourState[];
  open_market_count: number;
  closure_summary_ja: string | null;
}

export interface ExchangeSessionRole {
  exchange: string;
  name_ja: string;
  primary_session_id: string;
  note_ja: string;
}

export interface EntryTimingHint {
  summary_ja: string;
  detail_ja: string;
  next_high_activity_jst: string | null;
}

export interface MarketSessionsResponse {
  clocks: ClockDisplay[];
  sessions: MarketSessionBlock[];
  timeline_jst: TimelineHour[];
  exchanges: ExchangeSessionRole[];
  entry_hint: EntryTimingHint;
  generated_at: string;
  jst_day_type: DayType;
  timeline_caption_ja: string;
}
