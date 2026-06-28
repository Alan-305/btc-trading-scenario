from __future__ import annotations

from datetime import datetime, timezone

import structlog

from app.collectors.http_client import CollectorHttpClient
from app.config import get_settings
from app.schemas.extended_market import BtcEtfFlowSnapshot

logger = structlog.get_logger()

YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
DEFAULT_TICKERS = ("IBIT", "FBTC", "ARKB", "BITB", "GBTC")


class BtcEtfFlowClient:
    """Estimate US spot BTC ETF flow from Yahoo Finance volume × price change (proxy)."""

    def __init__(self, http: CollectorHttpClient):
        self.http = http
        self._settings = get_settings()

    async def fetch_snapshot(self) -> BtcEtfFlowSnapshot | None:
        coinglass = await self._try_coinglass()
        if coinglass:
            return coinglass
        return await self._fetch_yahoo_proxy()

    async def _try_coinglass(self) -> BtcEtfFlowSnapshot | None:
        key = (self._settings.coinglass_api_key or "").strip()
        if not key:
            return None
        try:
            base = self._settings.coinglass_base_url.rstrip("/")
            data = await self.http.get_json(
                f"{base}/api/etf/bitcoin/flow-history",
                headers={"CG-API-KEY": key},
                rate_limit_key="coinglass",
            )
            rows = data.get("data") or []
            if not rows:
                return None
            recent = rows[-3:]
            flows = [float(r.get("flowUsd") or r.get("flow_usd") or 0) for r in recent]
            net_1d = flows[-1] if flows else None
            net_3d = sum(flows) if flows else None
            trend = _trend_from_flow(net_3d)
            return BtcEtfFlowSnapshot(
                net_flow_1d_usd=round(net_1d, 0) if net_1d is not None else None,
                net_flow_3d_usd=round(net_3d, 0) if net_3d is not None else None,
                trend=trend,
                tickers_tracked=["coinglass_aggregate"],
                source="coinglass",
                timestamp=datetime.now(timezone.utc),
            )
        except Exception as exc:
            logger.warning("coinglass_etf_failed", error=str(exc))
            return None

    async def _fetch_yahoo_proxy(self) -> BtcEtfFlowSnapshot | None:
        tickers = list(DEFAULT_TICKERS)
        daily_flows: list[float] = []

        for symbol in tickers:
            try:
                data = await self.http.get_json(
                    YAHOO_CHART.format(symbol=symbol),
                    params={"interval": "1d", "range": "5d"},
                    headers={"User-Agent": "btc-trading-scenario/1.0"},
                    rate_limit_key="yahoo",
                )
                result = (data.get("chart") or {}).get("result") or []
                if not result:
                    continue
                quotes = result[0].get("indicators", {}).get("quote", [{}])[0]
                closes = [c for c in (quotes.get("close") or []) if c is not None]
                volumes = [v for v in (quotes.get("volume") or []) if v is not None]
                if len(closes) < 2 or len(volumes) < 2:
                    continue
                for i in range(1, len(closes)):
                    prev, curr = closes[i - 1], closes[i]
                    vol = volumes[i] if i < len(volumes) else volumes[-1]
                    if prev <= 0 or vol is None:
                        continue
                    direction = 1.0 if curr >= prev else -1.0
                    daily_flows.append(direction * float(vol) * float(curr))
            except Exception as exc:
                logger.warning("yahoo_etf_symbol_failed", symbol=symbol, error=str(exc))

        if not daily_flows:
            return None

        # Group by day index approximation: last chunk per ticker summed
        net_1d = daily_flows[-len(tickers) :] if len(daily_flows) >= len(tickers) else daily_flows[-1:]
        flow_1d = sum(net_1d)
        flow_3d = sum(daily_flows[-3 * len(tickers) :]) if daily_flows else flow_1d

        return BtcEtfFlowSnapshot(
            net_flow_1d_usd=round(flow_1d, 0),
            net_flow_3d_usd=round(flow_3d, 0),
            trend=_trend_from_flow(flow_3d),
            tickers_tracked=tickers,
            source="yahoo_proxy",
            timestamp=datetime.now(timezone.utc),
        )


def _trend_from_flow(flow: float | None) -> str:
    if flow is None:
        return "neutral"
    if flow > 50_000_000:
        return "inflow"
    if flow < -50_000_000:
        return "outflow"
    return "neutral"
