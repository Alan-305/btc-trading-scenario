import type { MacroEvent } from "../types/macro-events";
import { formatMacroEventChartLabel } from "./candle-interval";

const CHART_EVENT_WINDOW_MS = 8 * 24 * 60 * 60 * 1000;
const FUTURE_EVENT_GRACE_MS = 30 * 60 * 1000;

export interface MacroEventMarker {
  ts: string;
  isoTs: string;
  events: MacroEvent[];
  impact: "high" | "medium";
}

export interface ChartRowWithTime {
  ts: string;
  isoTs?: string;
  kind: "past" | "now" | "future" | "macro";
  pastPrice?: number | null;
  futurePrice?: number | null;
}

function rowTimeMs(row: ChartRowWithTime, nowMs: number): number | null {
  if (row.isoTs) {
    const ms = new Date(row.isoTs).getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  if (row.kind === "now") return nowMs;
  return null;
}

function markerImpact(events: MacroEvent[]): "high" | "medium" {
  return events.some((event) => event.impact === "high") ? "high" : "medium";
}

function isOfficialNfp(event: MacroEvent): boolean {
  const name = event.name.toLowerCase();
  return name.includes("non-farm employment change") && !name.includes("adp");
}

export function chartMacroEvents(events: MacroEvent[]): MacroEvent[] {
  return events.filter((event) => {
    if (event.impact !== "high") return false;
    if (event.country === "US") return true;
    return false;
  });
}

function insertRowsByTime<T extends ChartRowWithTime>(
  rows: T[],
  insertions: Array<{ ms: number; row: T }>,
  nowMs: number,
): T[] {
  if (!insertions.length) return rows;

  const result = [...rows];
  for (const insertion of [...insertions].sort((a, b) => a.ms - b.ms)) {
    let insertAt = result.length;
    for (let index = 0; index < result.length; index += 1) {
      const ms = rowTimeMs(result[index], nowMs);
      if (ms != null && ms > insertion.ms) {
        insertAt = index;
        break;
      }
    }
    result.splice(insertAt, 0, insertion.row);
  }
  return result;
}

/** Place macro markers on entry chart at scheduled JST times (no 4h bar snapping). */
export function mergeMacroEventMarkers<T extends ChartRowWithTime>(
  rows: T[],
  events: MacroEvent[],
  nowMs = Date.now(),
): { rows: T[]; markers: MacroEventMarker[] } {
  if (!rows.length || !events.length) {
    return { rows, markers: [] };
  }

  const chartStartMs = rows.reduce<number | null>((min, row) => {
    const ms = rowTimeMs(row, nowMs);
    if (ms == null) return min;
    return min == null ? ms : Math.min(min, ms);
  }, null);

  const chartEndMs = rows.reduce<number | null>((max, row) => {
    const ms = rowTimeMs(row, nowMs);
    if (ms == null) return max;
    return max == null ? ms : Math.max(max, ms);
  }, null);

  const windowStart = chartStartMs ?? nowMs - CHART_EVENT_WINDOW_MS;
  const windowEnd = Math.max(chartEndMs ?? nowMs, nowMs) + CHART_EVENT_WINDOW_MS;

  const relevantEvents = chartMacroEvents(events).filter((event) => {
    const eventMs = new Date(event.scheduled_at).getTime();
    return !Number.isNaN(eventMs) && eventMs >= windowStart && eventMs <= windowEnd;
  });

  const insertionGroups = new Map<string, { ms: number; events: MacroEvent[] }>();
  for (const event of relevantEvents) {
    const eventMs = new Date(event.scheduled_at).getTime();
    if (Number.isNaN(eventMs)) continue;
    const isoTs = new Date(eventMs).toISOString();
    const ts = formatMacroEventChartLabel(isoTs);
    const key = `${eventMs}|${ts}`;
    const group = insertionGroups.get(key) ?? { ms: eventMs, events: [] };
    group.events.push(event);
    insertionGroups.set(key, group);
  }

  const markers: MacroEventMarker[] = [];
  const insertions: Array<{ ms: number; row: T }> = [];

  for (const group of insertionGroups.values()) {
    group.events.sort((a, b) => {
      if (isOfficialNfp(a) && !isOfficialNfp(b)) return -1;
      if (!isOfficialNfp(a) && isOfficialNfp(b)) return 1;
      return a.name.localeCompare(b.name);
    });

    const isoTs = new Date(group.ms).toISOString();
    const ts = formatMacroEventChartLabel(isoTs);
    markers.push({
      ts,
      isoTs,
      events: group.events,
      impact: markerImpact(group.events),
    });

    insertions.push({
      ms: group.ms,
      row: {
        ts,
        isoTs,
        kind: "macro",
        pastPrice: null,
        futurePrice: null,
      } as T,
    });
  }

  return {
    rows: insertRowsByTime(rows, insertions, nowMs),
    markers,
  };
}

export function upcomingHighImpactEvents(events: MacroEvent[], withinHours = 48): MacroEvent[] {
  const now = Date.now();
  const limit = now + withinHours * 60 * 60 * 1000;
  return events.filter((event) => {
    if (event.impact !== "high") return false;
    const ms = new Date(event.scheduled_at).getTime();
    return !Number.isNaN(ms) && ms >= now - FUTURE_EVENT_GRACE_MS && ms <= limit;
  });
}

/** @deprecated Use mergeMacroEventMarkers instead. */
export function alignMacroEventsToChartRows(
  rows: ChartRowWithTime[],
  events: MacroEvent[],
): MacroEventMarker[] {
  return mergeMacroEventMarkers(rows, events).markers;
}
