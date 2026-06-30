import { useEffect, useState, type ReactNode } from "react";

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  summary?: string;
  /** Uncontrolled initial state (alias: defaultOpen). */
  defaultExpanded?: boolean;
  defaultOpen?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  headerActions?: ReactNode;
  storageKey?: string;
  className?: string;
  children: ReactNode;
}

function readStoredOpen(storageKey: string | undefined, defaultExpanded: boolean): boolean {
  if (!storageKey) return defaultExpanded;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === "0") return false;
    if (raw === "1") return true;
  } catch {
    // ignore
  }
  return defaultExpanded;
}

export function CollapsibleSection({
  title,
  subtitle,
  summary,
  defaultExpanded,
  defaultOpen,
  expanded: controlledExpanded,
  onExpandedChange,
  headerActions,
  storageKey,
  className = "",
  children,
}: CollapsibleSectionProps) {
  const initialExpanded = defaultExpanded ?? defaultOpen ?? false;
  const [internalExpanded, setInternalExpanded] = useState(() =>
    readStoredOpen(storageKey, initialExpanded),
  );
  const expanded = controlledExpanded ?? internalExpanded;

  const setExpanded = (next: boolean) => {
    onExpandedChange?.(next);
    if (controlledExpanded === undefined) {
      setInternalExpanded(next);
    }
  };

  useEffect(() => {
    if (!storageKey || controlledExpanded !== undefined) return;
    try {
      localStorage.setItem(storageKey, internalExpanded ? "1" : "0");
    } catch {
      // ignore
    }
  }, [internalExpanded, storageKey, controlledExpanded]);

  return (
    <section
      className={`rounded-xl border border-surface-border bg-surface-card p-5 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="min-h-[44px] flex-1 rounded-lg text-left hover:bg-surface-hover/40"
          aria-expanded={expanded}
        >
          <div className="flex items-start gap-2">
            <span
              className="mt-0.5 text-content-muted transition-transform"
              aria-hidden
              style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
            >
              ▶
            </span>
            <div>
              <h2 className="font-japanese text-sm font-medium text-slate-300">{title}</h2>
              {subtitle ? <p className="mt-1 text-xs text-content-muted">{subtitle}</p> : null}
              {summary ? (
                <p className="mt-1 text-xs text-accent-blue">
                  {summary}
                  {!expanded ? " — クリックで開く" : ""}
                </p>
              ) : null}
            </div>
          </div>
        </button>
        {headerActions ? <div className="flex flex-wrap gap-2">{headerActions}</div> : null}
      </div>
      {expanded ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}
