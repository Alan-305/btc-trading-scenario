export type MacroTrend = "bullish" | "bearish" | "range";
export type TradeSide = "long" | "short" | "neutral";

export interface EntryZone {
  side: TradeSide;
  zone_low: number;
  zone_high: number;
  rationale: string;
}

export interface ExitStrategy {
  take_profit: number[];
  stop_loss: number;
  rationale: string;
}

export interface ForecastPoint {
  ts: string;
  price: number;
}

export interface ScenarioIndicators {
  fear_greed: number | null;
  funding_rate: number | null;
  oi_change_24h_pct: number | null;
  divergence_max_pct: number | null;
  ta_trend?: MacroTrend | null;
  rsi_14?: number | null;
  put_call_ratio?: number | null;
  dvol_index?: number | null;
  etf_flow_3d_usd?: number | null;
  etf_trend?: string | null;
  onchain_activity_trend?: string | null;
}

export interface ScenarioDataSources {
  research_items_used: number;
  includes_technical: boolean;
  includes_risk_zones: boolean;
  includes_sessions: boolean;
  includes_heatmap: boolean;
  includes_derivatives: boolean;
  includes_options?: boolean;
  includes_etf_flows?: boolean;
  includes_onchain?: boolean;
  personalized: boolean;
}

export type ScenarioHorizonId = "today" | "week" | "month" | "halving";
export type TradeBranch = "bullish" | "bearish";

export interface ScenarioHorizonBundle {
  id: ScenarioHorizonId;
  label: string;
  period_hint: string;
  entry: EntryZone;
  exit: ExitStrategy;
  forecast: ForecastPoint[];
  scenario_text_ja: string;
}

export interface DirectionalScenario {
  macro_trend: TradeBranch;
  confidence: number;
  entry: EntryZone;
  exit: ExitStrategy;
  forecast: ForecastPoint[];
  scenario_text_ja: string;
  horizons?: ScenarioHorizonBundle[];
}

export interface WatchScenario {
  confidence: number;
  range_low: number;
  range_high: number;
  support: number | null;
  resistance: number | null;
  scenario_text_ja: string;
  rationale: string;
}

export interface ScenarioResponse {
  macro_trend: MacroTrend;
  confidence: number;
  entry: EntryZone;
  exit: ExitStrategy;
  forecast: ForecastPoint[];
  scenario_text_ja: string;
  horizons?: ScenarioHorizonBundle[];
  bullish?: DirectionalScenario | null;
  bearish?: DirectionalScenario | null;
  watch?: WatchScenario | null;
  indicators: ScenarioIndicators;
  data_sources?: ScenarioDataSources | null;
  generated_at: string;
  disclaimer: string;
}

export interface NormalizedTicker {
  exchange: string;
  symbol: string;
  last_price: string;
  bid: string | null;
  ask: string | null;
  volume_24h: string | null;
  quote_volume_24h: string | null;
  timestamp: string;
}

export interface MarketSnapshot {
  tickers: NormalizedTicker[];
  orderbooks: unknown[];
  divergence_pct: Record<string, number>;
  collected_at: string;
}

export interface FearGreedHistoryPoint {
  period: "now" | "yesterday" | "last_week" | "last_month";
  label_ja: string;
  value: number;
  classification: string;
}

export interface FearGreedIndex {
  value: number;
  classification: string;
  timestamp: string;
}

export interface ExchangeDerivatives {
  exchange: string;
  symbol: string;
  funding_rate: number | null;
  open_interest_usd: number | null;
  long_short_ratio: number | null;
  mark_price: number | null;
  quote_currency: string | null;
}

export interface CoinglassSnapshot {
  open_interest_usd: number | null;
  funding_rate: number | null;
  liquidation_24h_usd: number | null;
  long_short_ratio: number | null;
  source: string | null;
  exchanges: ExchangeDerivatives[];
  timestamp: string;
}

export interface SentimentIndicators {
  fear_greed: FearGreedIndex | null;
  fear_greed_history: FearGreedHistoryPoint[];
  coinglass: CoinglassSnapshot | null;
  x_sentiment_score: number | null;
}

export interface HeatmapCell {
  price_bin: number;
  bid_depth: number;
  ask_depth: number;
}

export type HeatmapExchange = "all" | "whitebit" | "binance" | "bybit" | "bitget" | "coinbase";

export type MacroStance = "bullish" | "bearish" | "neutral" | "reversal" | "caution";

export interface MacroSeriesPoint {
  ts: string;
  value: number;
}

export interface BtcOptionsSnapshot {
  put_open_interest: number;
  call_open_interest: number;
  put_call_ratio: number;
  dvol_index: number | null;
  dvol_history: MacroSeriesPoint[];
  instrument_count: number;
  stance?: MacroStance;
  signal_ja?: string;
  summary_ja?: string;
  source: string;
  timestamp: string | null;
}

export interface BtcEtfFlowSnapshot {
  net_flow_1d_usd: number | null;
  net_flow_3d_usd: number | null;
  trend: "inflow" | "outflow" | "neutral";
  daily_flows: MacroSeriesPoint[];
  tickers_tracked: string[];
  stance?: MacroStance;
  signal_ja?: string;
  summary_ja?: string;
  source: string;
  timestamp: string | null;
}

export interface OnChainSnapshot {
  hash_rate_th_s: number | null;
  hash_rate_change_7d_pct: number | null;
  tx_count_24h: number | null;
  trade_volume_usd: number | null;
  mempool_fast_fee_sat: number | null;
  activity_trend: "rising" | "falling" | "stable";
  hash_rate_history: MacroSeriesPoint[];
  tx_count_history: MacroSeriesPoint[];
  stance?: MacroStance;
  signal_ja?: string;
  summary_ja?: string;
  source: string;
  timestamp: string | null;
}

export interface MacroContextSnapshot {
  options: BtcOptionsSnapshot | null;
  etf_flows: BtcEtfFlowSnapshot | null;
  onchain: OnChainSnapshot | null;
  overall_stance?: MacroStance;
  overall_signal_ja?: string;
  overall_summary_ja?: string;
}
