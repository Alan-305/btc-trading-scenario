import pytest

from app.integrations.okx_liquidations import OkxLiquidationClient


class _FakeHttp:
    async def get_json(self, url, *, params=None, headers=None, rate_limit_key=None):
        return {
            "code": "0",
            "data": [
                {
                    "details": [
                        {
                            "bkPx": "97500",
                            "sz": "10",
                            "posSide": "long",
                            "side": "sell",
                            "ts": "1782689909900",
                        },
                        {
                            "bkPx": "100500",
                            "sz": "2",
                            "posSide": "short",
                            "side": "buy",
                            "ts": "1782689909900",
                        },
                    ]
                }
            ],
        }


@pytest.mark.asyncio
async def test_okx_liquidation_client_parses_events():
    client = OkxLiquidationClient(_FakeHttp())  # type: ignore[arg-type]
    events = await client.fetch_recent(limit=10)
    assert len(events) == 2
    assert events[0].position_side == "long"
    assert events[0].notional_usd == pytest.approx(975_000, rel=1e-3)
