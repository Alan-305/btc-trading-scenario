export type DashboardSection = "overview" | "chart" | "market" | "context" | "journal";

export const DASHBOARD_SECTION_STORAGE_KEY = "btc-dashboard-section";

export interface DashboardNavItem {
  id: DashboardSection;
  label: string;
  description: string;
}

export const DASHBOARD_NAV: DashboardNavItem[] = [
  { id: "overview", label: "概要", description: "シナリオとエントリー判断" },
  { id: "chart", label: "チャート", description: "ローソク足" },
  { id: "market", label: "市場指標", description: "テクニカル・板・先物など" },
  { id: "context", label: "環境", description: "マクロ・時間帯・調査メモ" },
  { id: "journal", label: "記録", description: "日誌・的中率・保存" },
];

export function loadDashboardSection(): DashboardSection {
  try {
    const raw = localStorage.getItem(DASHBOARD_SECTION_STORAGE_KEY);
    if (DASHBOARD_NAV.some((n) => n.id === raw)) return raw as DashboardSection;
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
