from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_REPO_ROOT = Path(__file__).resolve().parents[2]
_BACKEND_ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(_REPO_ROOT / ".env", _BACKEND_ROOT / ".env"),
        extra="ignore",
    )

    app_env: str = "development"
    log_level: str = "INFO"

    redis_url: str = "redis://localhost:6379/0"
    cache_ttl_seconds: int = 60
    # auto = try Redis, fall back to in-memory | memory | redis
    cache_backend: str = "auto"

    whitebit_symbol: str = "BTC_USDT"
    whitebit_futures_symbol: str = "BTC_PERP"
    binance_symbol: str = "BTCUSDT"
    bybit_futures_symbol: str = "BTCUSDT"
    okx_futures_symbol: str = "BTC-USDT-SWAP"
    bitbank_symbol: str = "btc_jpy"
    coinbase_symbol: str = "BTC-USD"
    baseline_exchange: str = "whitebit"

    coinglass_api_key: str = ""
    coinglass_base_url: str = "https://open-api-v4.coinglass.com"
    # free = multi-exchange public APIs | coinglass = paid | auto = key があれば coinglass
    derivatives_provider: str = "free"
    # Comma-separated: binance,bybit,okx,whitebit
    derivatives_exchanges: str = "binance,bybit,okx,whitebit,bitbank"

    llm_provider: str = "gemini"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    gemini_model_fallbacks: str = "gemini-2.0-flash,gemini-2.5-flash-lite"
    anthropic_api_key: str = ""

    internal_collect_token: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
