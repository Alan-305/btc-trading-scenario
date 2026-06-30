from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.config import Settings, get_settings
from app.dependencies import require_invited_user
from app.services.email_service import send_paper_trade_fill_email

router = APIRouter()


class PaperTradeFillNotifyBody(BaseModel):
    side: str = Field(pattern="^(long|short)$")
    entry_price: float = Field(alias="entryPrice", gt=0)
    exit_price: float = Field(alias="exitPrice", gt=0)
    size_btc: float = Field(alias="sizeBtc", gt=0)
    stop_loss: float = Field(alias="stopLoss", gt=0)
    take_profit1: float | None = Field(default=None, alias="takeProfit1")
    take_profit2: float | None = Field(default=None, alias="takeProfit2")
    take_profit_target: str = Field(alias="takeProfitTarget", pattern="^(tp1|tp2)$")
    status: str = Field(pattern="^(closed_tp1|closed_tp2|closed_sl)$")
    status_label_ja: str = Field(alias="statusLabelJa", min_length=1)
    label: str = ""
    realized_pnl_usd: float = Field(alias="realizedPnlUsd")

    model_config = {"populate_by_name": True}


@router.post("/paper-trades/notify-fill")
async def notify_paper_trade_fill(
    body: PaperTradeFillNotifyBody,
    caller_email: str | None = Depends(require_invited_user),
    settings: Settings = Depends(get_settings),
):
    if not caller_email:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        send_paper_trade_fill_email(
            to=caller_email,
            side=body.side,
            status_label=body.status_label_ja,
            entry_price=body.entry_price,
            exit_price=body.exit_price,
            size_btc=body.size_btc,
            take_profit_target=body.take_profit_target,
            realized_pnl_usd=body.realized_pnl_usd,
            label=body.label,
            settings=settings,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return {"status": "sent"}
