import type { MacroEvent, MacroEventsResponse } from "../../types/macro-events";

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

function eventLabel(ev: MacroEvent): string {
  return ev.name_ja || ev.name;
}

interface EconomicCalendarPanelProps {
  data: MacroEventsResponse | null;
  loading?: boolean;
}

export function EconomicCalendarPanel({ data, loading }: EconomicCalendarPanelProps) {
  if (loading && !data) {
    return (
      <div className="rounded-xl border border-surface-border bg-surface-card p-5">
        <h3 className="font-japanese text-sm font-medium text-content-secondary">経済指標カレンダー</h3>
        <p className="mt-3 text-sm text-content-muted">読み込み中…</p>
      </div>
    );
  }

  const events = data?.events ?? [];
  const upcoming = events.filter((ev) => new Date(ev.scheduled_at).getTime() >= Date.now() - 3 * 60 * 60 * 1000);

  return (
    <section className="rounded-xl border border-surface-border bg-surface-card p-5">
      <header className="mb-4">
        <h3 className="font-japanese text-base font-medium text-slate-200">経済指標カレンダー</h3>
        <p className="mt-1 font-japanese text-[11px] text-content-muted">
          米国中心（
          {data?.source === "finnhub"
            ? "Finnhub"
            : data?.source === "forex_factory"
              ? "Forex Factory"
              : "FOMC静的"}
          ）— 高インパクトはエントリーチャートにも表示
        </p>
      </header>

      {data?.note_ja ? (
        <p className="mb-3 rounded-lg border border-accent-amber/30 bg-accent-amber/5 px-3 py-2 font-japanese text-xs text-amber-100/90">
          {data.note_ja}
        </p>
      ) : null}

      {upcoming.length === 0 ? (
        <p className="text-sm text-content-muted">直近の予定イベントはありません。</p>
      ) : (
        <ul className="space-y-2">
          {upcoming.slice(0, 12).map((ev) => {
            const style = IMPACT_STYLE[ev.impact];
            return (
              <li
                key={ev.event_id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-surface-border/60 bg-surface-elevated/40 px-3 py-2.5"
              >
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
          })}
        </ul>
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
