from __future__ import annotations

from dataclasses import dataclass, field

from app.schemas.candles import RiskZonesResponse, TechnicalAnalysisResponse
from app.schemas.market import CoinglassSnapshot, FearGreedIndex, MarketSnapshot, OrderbookHeatmapCell
from app.schemas.scenario_context import ResearchContextItem
from app.schemas.extended_market import (
    BtcEtfFlowSnapshot,
    BtcOptionsSnapshot,
    OnChainSnapshot,
)
from app.services.price_sanity import is_plausible_usd_price


@dataclass
class HeatmapSummary:
    strongest_bid_support_usd: float | None = None
    strongest_ask_resistance_usd: float | None = None
    bid_heavy_below_price: bool = False
    ask_heavy_above_price: bool = False


@dataclass
class ScenarioMarketContext:
    snapshot: MarketSnapshot
    reference_price: float
    fear_greed: FearGreedIndex | None
    derivatives: CoinglassSnapshot | None
    technical: TechnicalAnalysisResponse | None
    risk_zones: RiskZonesResponse | None
    sessions: MarketSessionsResponse | None
    heatmap: HeatmapSummary | None
    divergence_pct: dict[str, float]
    options: BtcOptionsSnapshot | None = None
    etf_flows: BtcEtfFlowSnapshot | None = None
    onchain: OnChainSnapshot | None = None
    research: list[ResearchContextItem] = field(default_factory=list)

    def to_writer_facts(
        self,
        *,
        macro_trend: str,
        confidence: float,
        side: str,
        entry_low: float,
        entry_high: float,
        take_profit: list[float],
        stop_loss: float,
    ) -> dict:
        facts: dict = {
            "macro_trend": macro_trend,
            "confidence_pct": round(confidence * 100),
            "side": side,
            "reference_price_usd": self.reference_price,
            "entry_zone_low_usd": entry_low,
            "entry_zone_high_usd": entry_high,
            "take_profit_usd": take_profit,
            "stop_loss_usd": stop_loss,
            "exchange_divergence_pct": self.divergence_pct,
        }

        if self.fear_greed:
            facts["fear_greed_index"] = self.fear_greed.value
            facts["fear_greed_classification"] = self.fear_greed.classification

        if self.derivatives:
            facts["funding_rate"] = self.derivatives.funding_rate
            facts["long_short_ratio"] = self.derivatives.long_short_ratio
            facts["open_interest_usd"] = self.derivatives.open_interest_usd
            facts["derivatives_source"] = self.derivatives.source
            if self.derivatives.exchanges:
                facts["derivatives_by_exchange"] = [
                    {
                        "exchange": ex.exchange,
                        "funding_rate": ex.funding_rate,
                        "long_short_ratio": ex.long_short_ratio,
                    }
                    for ex in self.derivatives.exchanges[:5]
                ]

        if self.technical:
            facts["technical_analysis"] = {
                "trend": self.technical.trend,
                "rsi_14": self.technical.rsi_14,
                "ema_20": self.technical.ema_20,
                "ema_50": self.technical.ema_50,
                "ema_200": self.technical.ema_200,
                "support_usd": self.technical.support,
                "resistance_usd": self.technical.resistance,
                "summary_ja": self.technical.summary_ja,
            }
            if self.technical.macd:
                facts["technical_analysis"]["macd_histogram"] = self.technical.macd.histogram

        if self.risk_zones:
            rz: dict = {"reference_price_usd": self.risk_zones.reference_price}
            if self.risk_zones.long_liquidation:
                rz["long_liquidation_zone"] = {
                    "low_usd": self.risk_zones.long_liquidation.zone_low,
                    "high_usd": self.risk_zones.long_liquidation.zone_high,
                    "label": self.risk_zones.long_liquidation.label,
                }
            if self.risk_zones.short_squeeze:
                rz["short_squeeze_zone"] = {
                    "low_usd": self.risk_zones.short_squeeze.zone_low,
                    "high_usd": self.risk_zones.short_squeeze.zone_high,
                    "label": self.risk_zones.short_squeeze.label,
                }
            facts["risk_zones"] = rz

        if self.sessions and self.sessions.entry_hint:
            facts["market_session"] = {
                "entry_timing_summary_ja": self.sessions.entry_hint.summary_ja,
                "entry_timing_detail_ja": self.sessions.entry_hint.detail_ja,
                "next_high_activity_jst": self.sessions.entry_hint.next_high_activity_jst,
                "jst_day_type": self.sessions.jst_day_type,
            }

        if self.heatmap:
            facts["orderbook_heatmap"] = {
                "strongest_bid_support_usd": self.heatmap.strongest_bid_support_usd,
                "strongest_ask_resistance_usd": self.heatmap.strongest_ask_resistance_usd,
                "bid_heavy_below_price": self.heatmap.bid_heavy_below_price,
                "ask_heavy_above_price": self.heatmap.ask_heavy_above_price,
            }

        if self.research:
            facts["user_research_summaries"] = [
                {
                    "title": item.title,
                    "summary_line": item.summary_line,
                    "source_type": item.source_type,
                    "tags": item.tags[:5],
                    "market_context": item.market_context,
                }
                for item in self.research[:20]
            ]

        if self.options:
            facts["btc_options"] = {
                "put_open_interest": self.options.put_open_interest,
                "call_open_interest": self.options.call_open_interest,
                "put_call_ratio": self.options.put_call_ratio,
                "dvol_index": self.options.dvol_index,
                "source": self.options.source,
            }

        if self.etf_flows:
            facts["btc_etf_flows"] = {
                "net_flow_1d_usd": self.etf_flows.net_flow_1d_usd,
                "net_flow_3d_usd": self.etf_flows.net_flow_3d_usd,
                "trend": self.etf_flows.trend,
                "tickers_tracked": self.etf_flows.tickers_tracked,
                "source": self.etf_flows.source,
            }

        if self.onchain:
            facts["onchain_metrics"] = {
                "hash_rate_th_s": self.onchain.hash_rate_th_s,
                "hash_rate_change_7d_pct": self.onchain.hash_rate_change_7d_pct,
                "tx_count_24h": self.onchain.tx_count_24h,
                "trade_volume_usd": self.onchain.trade_volume_usd,
                "mempool_fast_fee_sat": self.onchain.mempool_fast_fee_sat,
                "activity_trend": self.onchain.activity_trend,
                "source": self.onchain.source,
            }

        return facts


def summarize_heatmap(
    cells: list[OrderbookHeatmapCell],
    reference_price: float,
) -> HeatmapSummary | None:
    if not cells or reference_price <= 0:
        return None

    below = [c for c in cells if c.price_bin < reference_price]
    above = [c for c in cells if c.price_bin > reference_price]

    max_bid_below = max(below, key=lambda c: c.bid_depth, default=None) if below else None
    max_ask_above = max(above, key=lambda c: c.ask_depth, default=None) if above else None

    bid_heavy_below = any(
        c.bid_depth > c.ask_depth * 1.3 for c in below if c.price_bin >= reference_price * 0.97
    )
    ask_heavy_above = any(
        c.ask_depth > c.bid_depth * 1.3 for c in above if c.price_bin <= reference_price * 1.03
    )

    return HeatmapSummary(
        strongest_bid_support_usd=(
            max_bid_below.price_bin
            if max_bid_below
            and is_plausible_usd_price(max_bid_below.price_bin, reference_price, min_ratio=0.85, max_ratio=1.0)
            else None
        ),
        strongest_ask_resistance_usd=(
            max_ask_above.price_bin
            if max_ask_above
            and is_plausible_usd_price(max_ask_above.price_bin, reference_price, min_ratio=1.0, max_ratio=1.15)
            else None
        ),
        bid_heavy_below_price=bid_heavy_below,
        ask_heavy_above_price=ask_heavy_above,
    )
