import asyncio

from fastapi import APIRouter, Depends

from app.collectors.http_client import CollectorHttpClient
from app.dependencies import get_alternative_me, get_coinglass, get_http_client, get_redis_cache
from app.integrations.alternative_me import AlternativeMeClient
from app.integrations.btc_etf_flows import BtcEtfFlowClient
from app.integrations.deribit_options import DeribitOptionsClient
from app.integrations.derivatives_provider import DerivativesProvider
from app.integrations.onchain_metrics import OnChainMetricsClient
from app.schemas.extended_market import MacroContextSnapshot
from app.schemas.market import SentimentIndicators
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
    )


@router.get("/macro", response_model=MacroContextSnapshot)
async def macro_context(http: CollectorHttpClient = Depends(get_http_client)):
    options_client = DeribitOptionsClient(http)
    etf_client = BtcEtfFlowClient(http)
    onchain_client = OnChainMetricsClient(http)
    options, etf, onchain = await asyncio.gather(
        options_client.fetch_snapshot(),
        etf_client.fetch_snapshot(),
        onchain_client.fetch_snapshot(),
    )
    return MacroContextSnapshot(options=options, etf_flows=etf, onchain=onchain)
