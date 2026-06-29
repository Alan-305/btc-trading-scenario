import type { MacroEvent } from "../types/macro-events";

const FOUR_H_MS = 4 * 60 * 60 * 1000;

export interface MacroEventMarker {
  ts: string;
  isoTs: string;
  events: MacroEvent[];
  impact: "high" | "medium";
}

/** Match macro events to entry chart past bars (4h tolerance). */
export function alignMacroEventsToChartRows(
  rows: { ts: string; isoTs?: string; kind: "past" | "now" | "future" }[],
  events: MacroEvent[],
): MacroEventMarker[] {
  const pastRows = rows.filter((r) => r.kind === "past" && r.isoTs);
  const markers: MacroEventMarker[] = [];

  for (const row of pastRows) {
    const targetMs = new Date(row.isoTs!).getTime();
    if (Number.isNaN(targetMs)) continue;
    const matched = events.filter((ev) => {
      const evMs = new Date(ev.scheduled_at).getTime();
      return !Number.isNaN(evMs) && Math.abs(evMs - targetMs) <= FOUR_H_MS;
    });
    if (!matched.length) continue;
    const impact = matched.some((e) => e.impact === "high") ? "high" : "medium";
    markers.push({
      ts: row.ts,
      isoTs: row.isoTs!,
      events: matched,
      impact,
    });
  }

  return markers;
}

export function upcomingHighImpactEvents(events: MacroEvent[], withinHours = 48): MacroEvent[] {
  const now = Date.now();
  const limit = now + withinHours * 60 * 60 * 1000;
  return events.filter((ev) => {
    if (ev.impact !== "high") return false;
    const ms = new Date(ev.scheduled_at).getTime();
    return !Number.isNaN(ms) && ms >= now - 2 * 60 * 60 * 1000 && ms <= limit;
  });
}
