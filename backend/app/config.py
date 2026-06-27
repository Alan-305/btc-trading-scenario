from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    log_level: str = "INFO"

    redis_url: str = "redis://localhost:6379/0"
    cache_ttl_seconds: int = 60

    whitebit_symbol: str = "BTC_USDT"
    binance_symbol: str = "BTCUSDT"
    bitbank_symbol: str = "btc_jpy"
    coinbase_symbol: str = "BTC-USD"
    baseline_exchange: str = "whitebit"

    coinglass_api_key: str = ""
    coinglass_base_url: str = "https://open-api-v4.coinglass.com"

    llm_provider: str = "gemini"
    gemini_api_key: str = ""
    anthropic_api_key: str = ""

    internal_collect_token: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
