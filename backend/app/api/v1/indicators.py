import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.collectors.http_client import CollectorHttpClient
from app.dependencies import get_alternative_me, get_coinglass, get_http_client, get_redis_cache
from app.integrations.alternative_me import AlternativeMeClient
from app.integrations.btc_etf_flows import BtcEtfFlowClient
from app.integrations.coingecko_usdt_dominance import CoingeckoUsdtDominanceClient
from app.integrations.deribit_options import DeribitOptionsClient
from app.integrations.equity_indices import EquityIndicesClient
from app.integrations.finnhub_calendar import MacroEventsService
from app.integrations.derivatives_provider import DerivativesProvider
from app.integrations.onchain_metrics import OnChainMetricsClient
from app.schemas.macro_events import MacroEventsResponse
from app.schemas.extended_market import MacroContextSnapshot
from app.schemas.market import SentimentIndicators
from app.services.macro_events_cache import (
    is_live_macro_response,
    merge_with_last_good,
    should_bypass_short_cache,
)
from app.services.macro_analysis import enrich_macro_context
from app.storage.redis_cache import AppCache

router = APIRouter()


@router.get("/sentiment", response_model=SentimentIndicators)
async def sentiment(
    fear_greed_client: AlternativeMeClient = Depends(get_alternative_me),
    coinglass_client: DerivativesProvider = Depends(get_coinglass),
    cache: AppCache = Depends(get_redis_cache),
):
    fg_data = await fear_greed_client.fetch_fear_greed_indicators()
    cg = await coinglass_client.fetch_snapshot()

    if fg_data:
        await cache.set_json(AppCache.FEAR_GREED_KEY, fg_data.current.model_dump(mode="json"))
    if cg:
        await cache.set_json(AppCache.COINGLASS_KEY, cg.model_dump(mode="json"))

    return SentimentIndicators(
        fear_greed=fg_data.current if fg_data else None,
        fear_greed_history=fg_data.history if fg_data else [],
        coinglass=cg,
        x_sentiment_score=None,
        fetched_at=_latest_timestamp(
            fg_data.current.timestamp if fg_data else None,
            cg.timestamp if cg else None,
        ),
    )


@router.get("/macro", response_model=MacroContextSnapshot)
async def macro_context(http: CollectorHttpClient = Depends(get_http_client)):
    options_client = DeribitOptionsClient(http)
    etf_client = BtcEtfFlowClient(http)
    onchain_client = OnChainMetricsClient(http)
    usdt_client = CoingeckoUsdtDominanceClient(http)
    equity_client = EquityIndicesClient(http)
    options, etf, onchain, usdt, equity = await asyncio.gather(
        options_client.fetch_snapshot(),
        etf_client.fetch_snapshot(),
        onchain_client.fetch_snapshot(),
        usdt_client.fetch_snapshot(),
        equity_client.fetch_snapshot(),
    )
    return enrich_macro_context(
        MacroContextSnapshot(
            options=options,
            etf_flows=etf,
            onchain=onchain,
            usdt_dominance=usdt,
            equity_markets=equity,
            fetched_at=_latest_timestamp(
                options.timestamp if options else None,
                etf.timestamp if etf else None,
                onchain.timestamp if onchain else None,
                usdt.timestamp if usdt else None,
                equity.timestamp if equity else None,
            ),
        )
    )


def _latest_timestamp(*values: datetime | None) -> datetime:
    present = [v for v in values if v is not None]
    if not present:
        return datetime.now(timezone.utc)
    return max(present)


@router.get("/macro-events", response_model=MacroEventsResponse)
async def macro_events(
    days: int = 7,
    http: CollectorHttpClient = Depends(get_http_client),
    cache: AppCache = Depends(get_redis_cache),
):
    days = max(1, min(days, 30))
    cache_key = f"{AppCache.MACRO_EVENTS_KEY}:{days}"
    last_good_key = f"{AppCache.MACRO_EVENTS_KEY}:last_good:{days}"

    cached_raw = await cache.get_json(cache_key)
    cached = MacroEventsResponse.model_validate(cached_raw) if cached_raw else None
    if cached and not should_bypass_short_cache(cached):
        return cached

    last_good_raw = await cache.get_json(last_good_key)
    last_good = MacroEventsResponse.model_validate(last_good_raw) if last_good_raw else None

    service = MacroEventsService(http)
    fresh = await service.fetch(days=days)
    response = merge_with_last_good(fresh, last_good)

    if is_live_macro_response(fresh):
        payload = fresh.model_dump(mode="json")
        await cache.set_json(cache_key, payload, ttl=3600)
        await cache.set_json(last_good_key, payload, ttl=86400)
        return fresh

    ttl = 1800 if is_live_macro_response(response) else 300
    await cache.set_json(cache_key, response.model_dump(mode="json"), ttl=ttl)
    return response
