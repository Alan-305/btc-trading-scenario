from __future__ import annotations

from datetime import datetime, timezone

import structlog

from app.collectors.http_client import CollectorHttpClient
from app.schemas.extended_market import EquityIndexSnapshot, GlobalEquitySnapshot, MacroSeriesPoint

logger = structlog.get_logger()

YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"

INDEX_DEFS: tuple[tuple[str, str, str], ...] = (
    ("us", "米国（S&P500）", "^GSPC"),
    ("japan", "日経225", "^N225"),
    ("europe", "欧州（STOXX50）", "^STOXX50E"),
)


class EquityIndicesClient:
    """Fetch major equity index snapshots from Yahoo Finance (no API key)."""

    def __init__(self, http: CollectorHttpClient):
        self.http = http

    async def fetch_snapshot(self) -> GlobalEquitySnapshot | None:
        markets: list[EquityIndexSnapshot] = []
        for market_id, name_ja, symbol in INDEX_DEFS:
            row = await self._fetch_index(market_id, name_ja, symbol)
            if row:
                markets.append(row)
        if not markets:
            return None
        return GlobalEquitySnapshot(
            markets=markets,
            timestamp=datetime.now(timezone.utc),
        )

    async def _fetch_index(
        self,
        market_id: str,
        name_ja: str,
        symbol: str,
    ) -> EquityIndexSnapshot | None:
        try:
            data = await self.http.get_json(
                YAHOO_CHART.format(symbol=symbol),
                params={"interval": "1d", "range": "1mo"},
                headers={"User-Agent": "btc-trading-scenario/1.0"},
                rate_limit_key="yahoo",
            )
            result = (data.get("chart") or {}).get("result") or []
            if not result:
                return None
            meta = result[0]
            timestamps = meta.get("timestamp") or []
            quotes = meta.get("indicators", {}).get("quote", [{}])[0]
            closes = [c for c in (quotes.get("close") or []) if c is not None]
            if len(closes) < 2:
                return None

            last = float(closes[-1])
            prev = float(closes[-2])
            change_1d = ((last - prev) / prev) * 100 if prev else None

            change_5d = None
            if len(closes) >= 6:
                base = float(closes[-6])
                if base:
                    change_5d = ((last - base) / base) * 100

            history: list[MacroSeriesPoint] = []
            valid_closes = quotes.get("close") or []
            for i, close in enumerate(valid_closes):
                if close is None:
                    continue
                ts_raw = timestamps[i] if i < len(timestamps) else None
                if ts_raw is None:
                    continue
                history.append(
                    MacroSeriesPoint(
                        ts=datetime.fromtimestamp(int(ts_raw), tz=timezone.utc),
                        value=round(float(close), 2),
                    )
                )
            history = history[-14:]

            return EquityIndexSnapshot(
                market_id=market_id,
                name_ja=name_ja,
                symbol=symbol,
                last_price=round(last, 2),
                change_1d_pct=round(change_1d, 2) if change_1d is not None else None,
                change_5d_pct=round(change_5d, 2) if change_5d is not None else None,
                history=history,
            )
        except Exception as exc:
            logger.warning("yahoo_equity_index_failed", symbol=symbol, error=str(exc))
            return None
