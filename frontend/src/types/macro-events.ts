export type MacroEventImpact = "low" | "medium" | "high";

export interface MacroEvent {
  event_id: string;
  name: string;
  name_ja: string | null;
  country: string;
  scheduled_at: string;
  impact: MacroEventImpact;
  estimate: string | null;
  actual: string | null;
  previous: string | null;
  source: string;
}

export interface MacroEventsResponse {
  events: MacroEvent[];
  source: string;
  window_days: number;
  fetched_at: string | null;
  note_ja: string | null;
}
