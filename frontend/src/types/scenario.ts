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
  usdt_dominance_pct?: number | null;
  usdt_dominance_change_7d_pct?: number | null;
  usdt_dominance_trend?: string | null;
  stoch_k?: number | null;
  stoch_d?: number | null;
  stoch_last_cross?: "gc" | "dc" | null;
  mtf_summary_ja?: string | null;
  mtf_htf_aligned?: boolean | null;
  mtf_entry_blocked?: boolean | null;
  mtf_entry_timing_ready?: boolean | null;
  mtf_near_htf_barrier?: boolean | null;
}

export type MtfInterval = "1w" | "1d" | "4h" | "1h";
export type MtfTrend = "bullish" | "bearish" | "range";

export interface MtfTimeframeLayer {
  interval: MtfInterval;
  label_ja: string;
  trend: MtfTrend;
  support: number | null;
  resistance: number | null;
  stoch_last_cross?: "gc" | "dc" | null;
  stoch_zone?: "oversold" | "overbought" | "neutral" | null;
  summary_ja: string;
}

export interface MtfEntryGate {
  side: TradeSide;
  htf_aligned: boolean;
  entry_blocked: boolean;
  entry_timing_ready: boolean;
  near_htf_barrier: boolean;
  gate_summary_ja: string;
  caution_ja: string | null;
}

export interface MtfAnalysis {
  layers: MtfTimeframeLayer[];
  summary_ja: string;
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
  includes_usdt_dominance?: boolean;
  includes_equity_markets?: boolean;
  includes_mtf?: boolean;
  personalized: boolean;
}

export type ScenarioHorizonId = "today" | "week" | "hodl";
export type HorizonMode = "swing" | "hodl";
export type TradeBranch = "bullish" | "bearish";

export interface HoldBuyZone {
  label: string;
  zone_low: number;
  zone_high: number;
  rationale: string;
}

export interface CyclePeakTarget {
  cycle_label: string;
  peak_window: string;
  price_low: number;
  price_high: number;
  note_ja: string;
}

export interface HoldScenarioContext {
  cycle_phase_ja: string;
  days_since_halving: number;
  days_to_next_halving: number;
  last_halving_label: string;
  next_halving_label: string;
  cycle_window_note_ja: string;
  buy_zones: HoldBuyZone[];
  peak_targets: CyclePeakTarget[];
  research_notes: string[];
}

export interface ScenarioHorizonBundle {
  id: ScenarioHorizonId;
  label: string;
  period_hint: string;
  horizon_mode?: HorizonMode;
  hold_context?: HoldScenarioContext | null;
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
  mtf?: MtfAnalysis | null;
  mtf_gates?: MtfEntryGate[];
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

export interface UsdtDominanceSnapshot {
  dominance_pct: number;
  change_7d_pct: number | null;
  trend: "rising" | "falling" | "stable";
  history: MacroSeriesPoint[];
  stance?: MacroStance;
  signal_ja?: string;
  summary_ja?: string;
  source: string;
  timestamp: string | null;
}

export interface EquityIndexSnapshot {
  market_id: "us" | "japan" | "europe";
  name_ja: string;
  symbol: string;
  last_price: number;
  change_1d_pct: number | null;
  change_5d_pct: number | null;
  history: MacroSeriesPoint[];
  stance?: MacroStance;
  signal_ja?: string;
  summary_ja?: string;
}

export interface GlobalEquitySnapshot {
  markets: EquityIndexSnapshot[];
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
  usdt_dominance?: UsdtDominanceSnapshot | null;
  equity_markets?: GlobalEquitySnapshot | null;
  overall_stance?: MacroStance;
  overall_signal_ja?: string;
  overall_summary_ja?: string;
}
