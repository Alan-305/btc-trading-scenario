from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import structlog
from firebase_admin import firestore

from app.auth.firebase_auth import _ensure_firebase_app
from app.config import Settings, get_settings
from app.schemas.market import MarketSnapshot
from app.schemas.scenario import ScenarioResponse
from app.services.digest_subscribers import DigestSubscriber, list_morning_digest_subscribers
from app.services.email_service import send_morning_digest_email
from app.services.market_aggregator import MarketAggregator
from app.services.scenario_builder import ScenarioBuilder
from app.services.scenario_context import reference_price_from_snapshot
from app.storage.redis_cache import AppCache

logger = structlog.get_logger(__name__)


class MorningDigestService:
    def __init__(
        self,
        *,
        settings: Settings | None = None,
        builder: ScenarioBuilder | None = None,
        aggregator: MarketAggregator | None = None,
        cache: AppCache | None = None,
    ):
        self.settings = settings or get_settings()
        self.builder = builder
        self.aggregator = aggregator
        self.cache = cache or AppCache()

    async def run(self, *, dry_run: bool = False) -> dict[str, Any]:
        if not self.settings.morning_digest_enabled:
            return {"status": "skipped", "reason": "morning_digest_disabled"}

        if self.builder is None or self.aggregator is None:
            raise RuntimeError("MorningDigestService requires builder and aggregator")

        run_id = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S") + f"-{uuid4().hex[:8]}"
        started_at = datetime.now(timezone.utc)
        log_ref = self._digest_log_ref(run_id)
        log_ref.set(
            {
                "runId": run_id,
                "status": "running",
                "startedAt": started_at,
                "dryRun": dry_run,
            }
        )

        subscribers = list_morning_digest_subscribers()
        stats: dict[str, Any] = {
            "status": "completed",
            "run_id": run_id,
            "dry_run": dry_run,
            "subscribers_total": len(subscribers),
            "sent": 0,
            "failed": 0,
            "retried": 0,
            "errors": [],
        }

        try:
            snapshot = await self.aggregator.collect_all(include_orderbooks=False)
            reference_price = reference_price_from_snapshot(snapshot)
            scenario = await self.builder.build()
            await self.cache.set_json(
                AppCache.SCENARIO_KEY,
                scenario.model_dump(mode="json"),
                ttl=120,
            )
            await self.cache.set_market_snapshot(snapshot)

            stats["reference_price"] = reference_price
            stats["scenario_generated_at"] = scenario.generated_at.isoformat()

            if dry_run:
                stats["status"] = "dry_run"
                self._finalize_log(log_ref, started_at, stats)
                return stats

            if not subscribers:
                stats["status"] = "no_subscribers"
                self._finalize_log(log_ref, started_at, stats)
                return stats

            for subscriber in subscribers:
                send_stats = self._send_with_retry(
                    subscriber=subscriber,
                    scenario=scenario,
                    snapshot=snapshot,
                    reference_price=reference_price,
                )
                stats["sent"] += send_stats["sent"]
                stats["failed"] += send_stats["failed"]
                stats["retried"] += send_stats["retried"]
                if send_stats["error"]:
                    stats["errors"].append(send_stats["error"])

            if stats["failed"] and stats["sent"]:
                stats["status"] = "partial"
            elif stats["failed"]:
                stats["status"] = "failed"

            self._finalize_log(log_ref, started_at, stats)
            return stats
        except Exception as exc:
            logger.exception("morning_digest_failed", run_id=run_id)
            stats["status"] = "failed"
            stats["errors"].append({"error": str(exc)})
            self._finalize_log(log_ref, started_at, stats)
            raise

    def _send_with_retry(
        self,
        *,
        subscriber: DigestSubscriber,
        scenario: ScenarioResponse,
        snapshot: MarketSnapshot,
        reference_price: float,
    ) -> dict[str, Any]:
        max_retries = max(0, self.settings.morning_digest_retry_count)
        last_error: str | None = None

        for attempt in range(max_retries + 1):
            try:
                send_morning_digest_email(
                    to=subscriber.email,
                    scenario=scenario,
                    snapshot=snapshot,
                    reference_price=reference_price,
                    unsubscribe_token=subscriber.unsubscribe_token,
                    settings=self.settings,
                )
                return {"sent": 1, "failed": 0, "retried": attempt, "error": None}
            except Exception as exc:
                last_error = str(exc)
                logger.warning(
                    "morning_digest_send_failed",
                    email=subscriber.email,
                    attempt=attempt + 1,
                    error=last_error,
                )
                if attempt < max_retries:
                    time.sleep(1.0 * (attempt + 1))

        return {
            "sent": 0,
            "failed": 1,
            "retried": max_retries,
            "error": {"email": subscriber.email, "error": last_error or "unknown"},
        }

    def _digest_log_ref(self, run_id: str):
        _ensure_firebase_app()
        return firestore.client().collection("digestLogs").document(run_id)

    def _finalize_log(self, log_ref, started_at: datetime, stats: dict[str, Any]) -> None:
        completed_at = datetime.now(timezone.utc)
        log_ref.set(
            {
                "status": stats.get("status"),
                "startedAt": started_at,
                "completedAt": completed_at,
                "dryRun": stats.get("dry_run", False),
                "subscribersTotal": stats.get("subscribers_total", 0),
                "sent": stats.get("sent", 0),
                "failed": stats.get("failed", 0),
                "retried": stats.get("retried", 0),
                "errors": stats.get("errors", []),
                "referencePrice": stats.get("reference_price"),
                "scenarioGeneratedAt": stats.get("scenario_generated_at"),
            },
            merge=True,
        )


def _serialize_log_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat()
    return value


def list_recent_digest_logs(limit: int = 10) -> list[dict[str, Any]]:
    _ensure_firebase_app()
    db = firestore.client()
    query = db.collection("digestLogs").order_by("startedAt", direction=firestore.Query.DESCENDING).limit(limit)
    logs: list[dict[str, Any]] = []
    for snapshot in query.stream():
        data = snapshot.to_dict() or {}
        serialized = {key: _serialize_log_value(val) for key, val in data.items()}
        serialized["id"] = snapshot.id
        logs.append(serialized)
    return logs
