import { useMemo, useState } from "react";
import type { MacroEvent, MacroEventsResponse } from "../../types/macro-events";
import type { DataRefreshProps } from "../../types/data-refresh";
import { EXTERNAL_LINKS } from "../../lib/external-links";
import { DataPanelMeta } from "../ui/DataPanelMeta";

const IMPACT_STYLE: Record<
  MacroEvent["impact"],
  { dot: string; label: string; badge: string }
> = {
  high: {
    dot: "bg-accent-red",
    label: "高",
    badge: "bg-accent-red/15 text-red-200",
  },
  medium: {
    dot: "bg-amber-400",
    label: "中",
    badge: "bg-amber-500/15 text-amber-200",
  },
  low: {
    dot: "bg-slate-400",
    label: "低",
    badge: "bg-surface-elevated text-content-muted",
  },
};

const COLLAPSED_VISIBLE = 5;

function calendarSourceLink(source: string | undefined): { href: string; label: string } {
  if (source === "finnhub") {
    return { href: EXTERNAL_LINKS.finnhub, label: "Finnhub" };
  }
  if (source === "forex_factory") {
    return { href: EXTERNAL_LINKS.forexFactory, label: "Forex Factory" };
  }
  return { href: EXTERNAL_LINKS.finnhub, label: "FOMC" };
}

function formatEventTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
}

function eventLabel(ev: MacroEvent): string {
  return ev.name_ja || ev.name;
}

function MacroEventRow({ ev }: { ev: MacroEvent }) {
  const style = IMPACT_STYLE[ev.impact];
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-surface-border/60 bg-surface-elevated/40 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} aria-hidden />
          <span className="font-japanese text-xs font-medium text-slate-200">{eventLabel(ev)}</span>
          <span className={`rounded px-1.5 py-0.5 font-japanese text-[10px] ${style.badge}`}>
            {ev.country}・{style.label}
          </span>
        </div>
        <p className="font-japanese text-[10px] text-content-muted">{formatEventTime(ev.scheduled_at)}</p>
        {(ev.estimate || ev.previous) && (
          <p className="mt-1 font-japanese text-[10px] text-content-muted">
            {ev.previous ? `前回 ${ev.previous}` : ""}
            {ev.estimate ? `${ev.previous ? " / " : ""}予想 ${ev.estimate}` : ""}
            {ev.actual ? ` / 結果 ${ev.actual}` : ""}
          </p>
        )}
      </div>
    </li>
  );
}

interface EconomicCalendarPanelProps extends DataRefreshProps {
  data: MacroEventsResponse | null;
  loading?: boolean;
}

export function EconomicCalendarPanel({
  data,
  loading,
  onRefresh,
  refreshing,
}: EconomicCalendarPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const upcoming = useMemo(() => {
    const events = data?.events ?? [];
    return events
      .filter((ev) => new Date(ev.scheduled_at).getTime() >= Date.now() - 3 * 60 * 60 * 1000)
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  }, [data?.events]);

  const visibleEvents = useMemo(
    () => (expanded ? upcoming : upcoming.slice(0, COLLAPSED_VISIBLE)),
    [expanded, upcoming],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, MacroEvent[]>();
    for (const ev of visibleEvents) {
      const key = formatDayKey(ev.scheduled_at);
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [visibleEvents]);

  const hiddenCount = Math.max(0, upcoming.length - COLLAPSED_VISIBLE);
  const needsCollapse = upcoming.length > COLLAPSED_VISIBLE;

  const sourceLink = calendarSourceLink(data?.source);
  const sourceLabelText =
    data?.source === "finnhub"
      ? "Finnhub"
      : data?.source === "forex_factory"
        ? "Forex Factory"
        : "FOMC静的";

  if (loading && !data) {
    return (
      <div className="rounded-xl border border-surface-border bg-surface-card p-5">
        <DataPanelMeta
          title="経済指標カレンダー"
          sourceHref={EXTERNAL_LINKS.finnhub}
          sourceLabel="Finnhub"
          onRefresh={onRefresh}
          refreshing={refreshing || loading}
          refreshLabel="経済カレンダーを更新"
        />
        <p className="mt-3 text-sm text-content-muted">読み込み中…</p>
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-surface-border bg-surface-card p-5">
      <DataPanelMeta
        title="経済指標カレンダー"
        subtitle={`米国中心（${sourceLabelText}）— 高インパクトはエントリーチャートにも表示${
          upcoming.length > 0 ? ` · 予定 ${upcoming.length} 件` : ""
        }`}
        sourceHref={sourceLink.href}
        sourceLabel={sourceLink.label}
        updatedAt={data?.fetched_at}
        onRefresh={onRefresh}
        refreshing={refreshing}
        refreshLabel="経済カレンダーを更新"
        className="mb-4"
      />

      {data?.note_ja ? (
        <p className="mb-3 rounded-lg border border-accent-amber/30 bg-accent-amber/5 px-3 py-2 font-japanese text-xs text-amber-100/90">
          {data.note_ja}
        </p>
      ) : null}

      {upcoming.length === 0 ? (
        <p className="text-sm text-content-muted">直近の予定イベントはありません。</p>
      ) : (
        <div className="space-y-3">
          {grouped.map(([dayLabel, dayEvents], index) => (
            <details
              key={dayLabel}
              className="group rounded-lg border border-surface-border/60 bg-surface-elevated/20"
              open={expanded || index === 0}
            >
              <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="font-japanese text-xs font-medium text-slate-200">{dayLabel}</span>
                <span className="font-japanese text-[10px] text-content-muted">{dayEvents.length} 件</span>
              </summary>
              <ul className="space-y-2 border-t border-surface-border/40 px-2 pb-2 pt-2">
                {dayEvents.map((ev) => (
                  <MacroEventRow key={ev.event_id} ev={ev} />
                ))}
              </ul>
            </details>
          ))}

          {needsCollapse ? (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="min-h-[44px] w-full rounded-lg border border-surface-border px-3 py-2 font-japanese text-xs text-content-secondary transition hover:border-content-muted hover:text-slate-200"
              aria-expanded={expanded}
            >
              {expanded ? "折りたたむ" : `さらに表示（あと ${hiddenCount} 件）`}
            </button>
          ) : null}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-3 font-japanese text-[10px] text-content-muted">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-accent-red" /> 高インパクト
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-400" /> 中インパクト
        </span>
      </div>
    </section>
  );
}

export function macroEventMarkerLabel(events: MacroEvent[]): string {
  const first = events[0];
  if (!first) return "📊";
  const short = first.name_ja || first.name;
  if (short.length <= 6) return short;
  return short.slice(0, 5) + "…";
}
