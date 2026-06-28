import { useEffect, type ReactNode } from "react";
import {
  DASHBOARD_NAV,
  type DashboardSection,
  saveDashboardSection,
} from "../../lib/dashboard-nav";

interface DashboardShellProps {
  activeSection: DashboardSection;
  onSectionChange: (section: DashboardSection) => void;
  mobileMenuOpen: boolean;
  onMobileMenuOpenChange: (open: boolean) => void;
  headerActions: ReactNode;
  children: ReactNode;
}

function NavButton({
  item,
  active,
  onClick,
  collapsed,
}: {
  item: (typeof DASHBOARD_NAV)[number];
  active: boolean;
  onClick: () => void;
  collapsed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue ${
        active
          ? "bg-accent-blue/15 text-white ring-1 ring-accent-blue/40"
          : "text-content-secondary hover:bg-surface-hover/60 hover:text-slate-200"
      }`}
    >
      <NavIcon id={item.id} active={active} />
      {!collapsed && (
        <span className="min-w-0">
          <span className="block font-japanese text-sm font-medium">{item.label}</span>
          <span className="block truncate font-japanese text-[10px] text-content-muted">{item.description}</span>
        </span>
      )}
    </button>
  );
}

function NavIcon({ id, active }: { id: DashboardSection; active: boolean }) {
  const color = active ? "text-accent-blue" : "text-content-muted";
  const paths: Record<DashboardSection, string> = {
    overview: "M4 6h16M4 12h16M4 18h10",
    chart: "M4 18V6l6 4 6-4v12",
    market: "M4 18h4v-6h4v6h4V8h4v10",
    context: "M12 3a9 9 0 100 18 9 9 0 000-18z",
    journal: "M6 4h12v16H6z",
  };
  return (
    <svg className={`h-5 w-5 shrink-0 ${color}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d={paths[id]} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DashboardShell({
  activeSection,
  onSectionChange,
  mobileMenuOpen,
  onMobileMenuOpenChange,
  headerActions,
  children,
}: DashboardShellProps) {
  const selectSection = (section: DashboardSection) => {
    onSectionChange(section);
    saveDashboardSection(section);
    onMobileMenuOpenChange(false);
  };

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onMobileMenuOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileMenuOpen, onMobileMenuOpenChange]);

  const sidebar = (
    <nav className="flex flex-col gap-1 p-3" aria-label="ダッシュボードメニュー">
      {DASHBOARD_NAV.map((item) => (
        <NavButton
          key={item.id}
          item={item}
          active={activeSection === item.id}
          onClick={() => selectSection(item.id)}
        />
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-surface lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-surface-border bg-surface-card lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="border-b border-surface-border px-5 py-5">
          <h1 className="font-english text-lg font-semibold tracking-tight text-white">BTC Scenario</h1>
          <p className="mt-1 font-japanese text-[10px] text-content-muted">トレード分析</p>
        </div>
        <div className="flex-1 overflow-y-auto">{sidebar}</div>
      </aside>

      {/* Mobile overlay menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="メニュー">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="メニューを閉じる"
            onClick={() => onMobileMenuOpenChange(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col border-r border-surface-border bg-surface-card shadow-xl">
            <div className="flex items-center justify-between border-b border-surface-border px-4 py-4">
              <span className="font-english font-semibold text-white">Menu</span>
              <button
                type="button"
                onClick={() => onMobileMenuOpenChange(false)}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-content-secondary hover:bg-surface-hover"
                aria-label="閉じる"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{sidebar}</div>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-surface-border bg-black/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onMobileMenuOpenChange(true)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-surface-border text-slate-300 hover:bg-surface-hover lg:hidden"
              aria-label="メニューを開く"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              </svg>
            </button>
            <div className="min-w-0 flex-1 lg:hidden">
              <p className="font-english text-sm font-semibold text-white">BTC Trading Scenario</p>
              <p className="font-japanese text-[10px] text-content-muted">
                {DASHBOARD_NAV.find((n) => n.id === activeSection)?.label}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">{headerActions}</div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-4 hidden lg:block">
            <h2 className="font-japanese text-lg font-medium text-slate-100">
              {DASHBOARD_NAV.find((n) => n.id === activeSection)?.label}
            </h2>
            <p className="mt-1 font-japanese text-xs text-content-muted">
              {DASHBOARD_NAV.find((n) => n.id === activeSection)?.description}
            </p>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
