from __future__ import annotations

import structlog
from firebase_admin import auth, firestore
from google.cloud.firestore_v1 import DocumentReference

from app.auth.firebase_auth import _ensure_firebase_app
from app.config import Settings, get_settings
from app.services.email_service import send_paper_trade_fill_email
from app.services.paper_trade_math import (
    PaperTradeResolution,
    PaperTradeState,
    realized_pnl_usd,
    resolve_paper_trade_exit,
    status_label_ja,
)

logger = structlog.get_logger(__name__)


def _num(data: dict, key: str) -> float | None:
    value = data.get(key)
    if isinstance(value, (int, float)) and float(value) == float(value):
        return float(value)
    return None


def _parse_trade(data: dict) -> PaperTradeState | None:
    side = data.get("side")
    if side not in ("long", "short"):
        return None
    entry_price = _num(data, "entryPrice")
    size_btc = _num(data, "sizeBtc")
    stop_loss = _num(data, "stopLoss")
    if entry_price is None or size_btc is None or stop_loss is None:
        return None
    take_profit_target = data.get("takeProfitTarget")
    if take_profit_target not in ("tp1", "tp2"):
        take_profit_target = "tp1"
    status = data.get("status") or "open"
    if status not in ("open", "closed_tp1", "closed_tp2", "closed_sl", "closed_manual"):
        status = "open"
    return PaperTradeState(
        side=side,
        status=status,  # type: ignore[arg-type]
        entry_price=entry_price,
        size_btc=size_btc,
        stop_loss=stop_loss,
        take_profit1=_num(data, "takeProfit1"),
        take_profit2=_num(data, "takeProfit2"),
        take_profit_target=take_profit_target,  # type: ignore[arg-type]
    )


def _user_id_from_trade_ref(doc_ref: DocumentReference) -> str | None:
    # users/{uid}/paperTrades/{tradeId}
    user_ref = doc_ref.parent.parent
    if user_ref is None:
        return None
    return user_ref.id


@firestore.transactional
def _close_trade_transaction(
    transaction: firestore.Transaction,
    doc_ref: DocumentReference,
    resolution: PaperTradeResolution,
    realized: float,
) -> bool:
    snapshot = doc_ref.get(transaction=transaction)
    if not snapshot.exists:
        return False
    data = snapshot.to_dict() or {}
    if data.get("status") != "open":
        return False
    transaction.update(
        doc_ref,
        {
            "status": resolution.status,
            "exitPrice": resolution.exit_price,
            "realizedPnlUsd": round(realized, 2),
            "closedAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
    )
    return True


def _lookup_user_email(uid: str) -> str | None:
    try:
        user = auth.get_user(uid)
    except Exception as exc:
        logger.warning("paper_trade_user_lookup_failed", uid=uid, error=str(exc))
        return None
    email = (user.email or "").strip().lower()
    return email or None


class PaperTradeMonitor:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()

    def process(self, reference_price: float) -> dict[str, int]:
        if reference_price <= 0:
            return {"scanned": 0, "closed": 0, "notified": 0, "errors": 0}

        _ensure_firebase_app()
        db = firestore.client()
        scanned = 0
        closed = 0
        notified = 0
        errors = 0

        query = db.collection_group("paperTrades").where("status", "==", "open")
        for snapshot in query.stream():
            scanned += 1
            data = snapshot.to_dict() or {}
            trade = _parse_trade(data)
            if trade is None:
                errors += 1
                continue

            resolution = resolve_paper_trade_exit(trade, reference_price)
            if resolution is None:
                continue

            realized = realized_pnl_usd(
                trade.side,
                trade.entry_price,
                resolution.exit_price,
                trade.size_btc,
            )
            doc_ref = snapshot.reference
            transaction = db.transaction()
            try:
                did_close = _close_trade_transaction(
                    transaction,
                    doc_ref,
                    resolution,
                    realized,
                )
            except Exception as exc:
                logger.warning("paper_trade_close_failed", trade_id=snapshot.id, error=str(exc))
                errors += 1
                continue

            if not did_close:
                continue

            closed += 1
            uid = _user_id_from_trade_ref(doc_ref)
            if not uid:
                errors += 1
                continue

            email = _lookup_user_email(uid)
            if not email:
                errors += 1
                continue

            label = data.get("label") if isinstance(data.get("label"), str) else ""
            try:
                send_paper_trade_fill_email(
                    to=email,
                    side=trade.side,
                    status_label=status_label_ja(resolution.status),
                    entry_price=trade.entry_price,
                    exit_price=resolution.exit_price,
                    size_btc=trade.size_btc,
                    take_profit_target=trade.take_profit_target,
                    realized_pnl_usd=realized,
                    label=label,
                    settings=self.settings,
                )
                notified += 1
            except Exception as exc:
                logger.warning(
                    "paper_trade_notify_failed",
                    trade_id=snapshot.id,
                    email=email,
                    error=str(exc),
                )
                errors += 1

        return {
            "scanned": scanned,
            "closed": closed,
            "notified": notified,
            "errors": errors,
        }
