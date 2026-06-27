import type { MacroTrend } from "./scenario";

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
  trend: MacroTrend | "neutral";
  summary_ja: string;
  overlay_series?: OverlayPoint[];
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
}

export interface PredictionEvaluation {
  saved_at: string | null;
  predicted_trend: string;
  reference_price: number;
  current_price: number;
  price_change_pct: number;
  direction_correct: boolean | null;
  entry_zone_hit: boolean | null;
  take_profit_hit: boolean | null;
  stop_loss_hit: boolean | null;
  outcome: "win" | "loss" | "partial" | "pending" | "neutral";
}

export interface AccuracySummary {
  total: number;
  evaluated: number;
  direction_accuracy_pct: number | null;
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
