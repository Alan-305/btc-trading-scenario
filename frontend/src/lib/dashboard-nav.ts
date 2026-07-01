export type DashboardSection = "overview" | "technical" | "context" | "records" | "invite";

export type IndicatorAnchorId =
  | "indicator-technical"
  | "indicator-stochastic"
  | "equity-markets"
  | "macro-environment"
  | "usdt-dominance"
  | "fear-greed"
  | "derivatives"
  | "heatmap"
  | "risk-zones"
  | "market-sessions"
  | "exchange-divergence"
  | "macro-calendar";

export interface IndicatorNavTarget {
  section: DashboardSection;
  anchorId: IndicatorAnchorId;
}

/** Maps indicator summary card ids to scroll targets within each section. */
export const INDICATOR_NAV_TARGETS: Record<string, IndicatorNavTarget> = {
  technical: { section: "technical", anchorId: "indicator-technical" },
  stochastic: { section: "technical", anchorId: "indicator-stochastic" },
  macro: { section: "context", anchorId: "macro-environment" },
  "equity-markets": { section: "context", anchorId: "equity-markets" },
  "usdt-dominance": { section: "context", anchorId: "usdt-dominance" },
  "fear-greed": { section: "technical", anchorId: "fear-greed" },
  derivatives: { section: "technical", anchorId: "derivatives" },
  heatmap: { section: "technical", anchorId: "heatmap" },
  risk: { section: "technical", anchorId: "risk-zones" },
  sessions: { section: "overview", anchorId: "market-sessions" },
  exchange: { section: "technical", anchorId: "exchange-divergence" },
};

export function scrollToIndicatorAnchor(
  anchorId: IndicatorAnchorId,
  onDone?: () => void,
  retries = 12,
): void {
  const el = document.getElementById(anchorId);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    onDone?.();
    return;
  }
  if (retries > 0) {
    window.setTimeout(() => scrollToIndicatorAnchor(anchorId, onDone, retries - 1), 120);
  }
}

export const DASHBOARD_SECTION_STORAGE_KEY = "btc-dashboard-section";

const LEGACY_SECTION_MAP: Record<string, DashboardSection> = {
  chart: "technical",
  market: "technical",
  journal: "records",
};

export interface DashboardNavItem {
  id: DashboardSection;
  label: string;
  description: string;
}

export const DASHBOARD_NAV_MAIN: DashboardNavItem[] = [
  { id: "overview", label: "シナリオ＆エントリー", description: "シナリオ・エントリー判断・世界時間" },
  { id: "technical", label: "テクニカル指標", description: "ローソク足・ストキャス・板・先物など" },
  { id: "context", label: "環境＆調査", description: "マクロ・株価指数・調査メモ" },
  { id: "records", label: "記録＆データ", description: "日誌・的中率・保存シナリオ" },
];

export const DASHBOARD_NAV_INVITE: DashboardNavItem = {
  id: "invite",
  label: "招待",
  description: "メンバーへの招待リンク送信",
};

/** @deprecated Use DASHBOARD_NAV_MAIN */
export const DASHBOARD_NAV = DASHBOARD_NAV_MAIN;

const ALL_SECTIONS: DashboardSection[] = [
  ...DASHBOARD_NAV_MAIN.map((n) => n.id),
  DASHBOARD_NAV_INVITE.id,
];

export function normalizeDashboardSection(raw: string | null | undefined): DashboardSection | null {
  if (!raw) return null;
  const migrated = LEGACY_SECTION_MAP[raw] ?? raw;
  if (ALL_SECTIONS.includes(migrated as DashboardSection)) {
    return migrated as DashboardSection;
  }
  return null;
}

export function loadDashboardSection(): DashboardSection {
  try {
    const normalized = normalizeDashboardSection(localStorage.getItem(DASHBOARD_SECTION_STORAGE_KEY));
    if (normalized) return normalized;
  } catch {
    /* ignore */
  }
  return "overview";
}

export function saveDashboardSection(section: DashboardSection): void {
  try {
    localStorage.setItem(DASHBOARD_SECTION_STORAGE_KEY, section);
  } catch {
    /* ignore */
  }
}
