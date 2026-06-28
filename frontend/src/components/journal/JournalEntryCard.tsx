import type { JournalEntry } from "../../types/journal";
import {
  JOURNAL_LINK_KIND_LABEL,
  JOURNAL_SIDE_LABEL,
  JOURNAL_STATUS_LABEL,
  JOURNAL_TYPE_LABEL,
  computeTradePnlPct,
  formatPrice,
  formatReviewScore,
  isActualTrade,
} from "../../lib/journal-utils";
import { ExternalLink } from "../ui/ExternalLink";

interface JournalEntryCardProps {
  entry: JournalEntry;
  onEdit: () => void;
  onDelete: () => void;
  onMarkAsTrade?: () => void;
}

function formatWhen(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function JournalEntryCard({ entry, onEdit, onDelete, onMarkAsTrade }: JournalEntryCardProps) {
  const pnlPct = computeTradePnlPct(entry);
  const showMarkAsTrade =
    onMarkAsTrade && entry.snapshotId && entry.type === "idea" && entry.side !== "watch";

  return (
    <article className="rounded-lg border border-surface-border/60 bg-surface px-4 py-3">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-japanese text-sm font-medium text-slate-100">{entry.title}</h3>
          <p className="mt-1 text-xs text-slate-500">{formatWhen(entry.createdAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
            {JOURNAL_TYPE_LABEL[entry.type]}
          </span>
          {entry.side && (
            <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
              {JOURNAL_SIDE_LABEL[entry.side]}
            </span>
          )}
          {entry.status && (
            <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
              {JOURNAL_STATUS_LABEL[entry.status]}
            </span>
          )}
          {entry.snapshotId && (
            <span className="rounded bg-accent-blue/20 px-2 py-0.5 text-[10px] text-accent-blue">
              AIシナリオ連携
            </span>
          )}
          {isActualTrade(entry) && (
            <span className="rounded bg-accent-green/20 px-2 py-0.5 text-[10px] text-accent-green">
              実トレード
            </span>
          )}
        </div>
      </div>

      {(entry.entryPrice != null ||
        entry.exitPrice != null ||
        entry.plannedSl != null ||
        entry.plannedTp != null) && (
        <dl className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-slate-500">Entry</dt>
            <dd className="font-english text-slate-200">{formatPrice(entry.entryPrice)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Exit</dt>
            <dd className="font-english text-slate-200">{formatPrice(entry.exitPrice)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">計画 SL</dt>
            <dd className="font-english text-slate-200">{formatPrice(entry.plannedSl)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">計画 TP</dt>
            <dd className="font-english text-slate-200">{formatPrice(entry.plannedTp)}</dd>
          </div>
          {pnlPct != null && (
            <div className="col-span-2 sm:col-span-4">
              <dt className="text-slate-500">実現損益</dt>
              <dd
                className={`font-english text-sm font-medium ${pnlPct >= 0 ? "text-accent-green" : "text-accent-red"}`}
              >
                {pnlPct >= 0 ? "+" : ""}
                {pnlPct.toFixed(2)}%
              </dd>
            </div>
          )}
        </dl>
      )}

      {entry.reviewScore != null || entry.reviewLesson ? (
        <div className="mb-3 rounded-lg border border-surface-border/40 bg-slate-900/30 px-3 py-2 text-xs">
          <p className="text-slate-500">振り返り</p>
          {entry.reviewScore != null && (
            <p className="mt-1 font-japanese text-slate-300">{formatReviewScore(entry.reviewScore)}</p>
          )}
          {entry.reviewLesson && (
            <p className="mt-1 font-japanese text-slate-400">{entry.reviewLesson}</p>
          )}
        </div>
      ) : null}

      {entry.images.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {entry.images.map((image) => (
            <a
              key={image.url}
              href={image.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-lg border border-surface-border"
            >
              <img
                src={image.url}
                alt={image.name}
                className="h-20 w-20 object-cover transition hover:opacity-90"
              />
            </a>
          ))}
        </div>
      )}

      {entry.note && (
        <p className="mb-3 whitespace-pre-wrap font-japanese text-sm leading-relaxed text-slate-300">
          {entry.note}
        </p>
      )}

      {entry.tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {entry.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {entry.links.length > 0 && (
        <ul className="mb-3 space-y-1">
          {entry.links.map((link) => (
            <li key={`${link.url}-${link.label}`} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500">{JOURNAL_LINK_KIND_LABEL[link.kind]}</span>
              <ExternalLink href={link.url}>{link.label}</ExternalLink>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-3 text-xs">
        {showMarkAsTrade && (
          <button
            type="button"
            onClick={onMarkAsTrade}
            className="min-h-[36px] text-accent-green hover:underline"
          >
            実トレードとして記録
          </button>
        )}
        <button
          type="button"
          onClick={onEdit}
          className="min-h-[36px] text-accent-blue hover:underline"
        >
          編集
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="min-h-[36px] text-slate-500 hover:text-red-300"
        >
          削除
        </button>
      </div>
    </article>
  );
}
