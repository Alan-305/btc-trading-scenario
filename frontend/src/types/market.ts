import type { MacroStance, MacroTrend } from "./scenario";

export interface Candle {
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CandlesResponse {
  symbol: string;
  interval: string;
  candles: Candle[];
  source: string;
  fetched_at?: string | null;
}

export interface MacdValues {
  macd: number;
  signal: number;
  histogram: number;
}

export interface BollingerValues {
  upper: number;
  middle: number;
  lower: number;
}

export interface OverlayPoint {
  ts: string;
  ema_200: number | null;
  bb_upper: number | null;
  bb_middle: number | null;
  bb_lower: number | null;
}

export interface StochSeriesPoint {
  ts: string;
  k: number;
  d: number;
  cross: "gc" | "dc" | null;
}

export interface TechnicalAnalysis {
  symbol: string;
  interval: string;
  rsi_14: number | null;
  ema_20: number | null;
  ema_50: number | null;
  ema_200: number | null;
  bollinger: BollingerValues | null;
  macd: MacdValues | null;
  support: number | null;
  resistance: number | null;
  atr_14?: number | null;
  adx_14?: number | null;
  stoch_k?: number | null;
  stoch_d?: number | null;
  stoch_last_cross?: "gc" | "dc" | null;
  stoch_last_cross_ts?: string | null;
  stoch_zone?: "oversold" | "overbought" | "neutral" | null;
  stoch_signal_ja?: string;
  stoch_summary_ja?: string;
  stoch_stance?: MacroStance;
  stoch_series?: StochSeriesPoint[];
  ichimoku_tenkan?: number | null;
  ichimoku_kijun?: number | null;
  ichimoku_senkou_a?: number | null;
  ichimoku_senkou_b?: number | null;
  ichimoku_cloud_top?: number | null;
  ichimoku_cloud_bottom?: number | null;
  ichimoku_price_vs_cloud?: "above" | "below" | "inside" | null;
  ichimoku_signal?: "sanyaku_kouten" | "sanyaku_gyakuten" | "neutral" | null;
  ichimoku_signal_ja?: string;
  ichimoku_summary_ja?: string;
  ichimoku_stance?: MacroStance;
  ichimoku_roles_met?: number;
  trend: MacroTrend | "neutral";
  summary_ja: string;
  overlay_series?: OverlayPoint[];
  source?: string;
  fetched_at?: string | null;
}

export interface RiskZone {
  zone_low: number;
  zone_high: number;
  label: string;
  rationale: string;
  confidence: number;
}

export interface RiskZonesResponse {
  reference_price: number;
  long_liquidation: RiskZone | null;
  short_squeeze: RiskZone | null;
  disclaimer: string;
  source?: string;
  fetched_at?: string | null;
}

export interface PredictionEvaluation {
  saved_at: string | null;
  predicted_trend: string;
  reference_price: number;
  current_price: number;
  price_change_pct: number;
  direction_correct: boolean | null;
  entry_zone_hit: boolean | null;
  entry_zone_reached: boolean | null;
  take_profit_hit: boolean | null;
  stop_loss_hit: boolean | null;
  outcome: "win" | "loss" | "partial" | "pending" | "neutral";
  status: "pending" | "final";
  swing_score_pct: number | null;
  days_remaining: number;
  trend_correct: boolean | null;
}

export interface AccuracySummary {
  total: number;
  evaluated: number;
  pending_count: number;
  finalized_count: number;
  direction_accuracy_pct: number | null;
  entry_zone_reach_pct: number | null;
  win_rate_pct: number | null;
  evaluations: PredictionEvaluation[];
}

export interface SavedPredictionInput {
  saved_at: string | null;
  macro_trend: MacroTrend;
  reference_price: number;
  entry_zone_low: number;
  entry_zone_high: number;
  take_profit: number[];
  stop_loss: number;
  side: "long" | "short" | "neutral";
}
