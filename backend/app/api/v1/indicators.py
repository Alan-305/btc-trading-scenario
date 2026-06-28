from fastapi import APIRouter, Depends

from app.dependencies import get_alternative_me, get_coinglass, get_redis_cache
from app.integrations.alternative_me import AlternativeMeClient
from app.integrations.derivatives_provider import DerivativesProvider
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
