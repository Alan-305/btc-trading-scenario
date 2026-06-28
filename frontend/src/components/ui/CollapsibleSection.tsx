import { useState, type ReactNode } from "react";

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  summary?: string;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  headerActions?: ReactNode;
  children: ReactNode;
}

export function CollapsibleSection({
  title,
  subtitle,
  summary,
  defaultExpanded = false,
  expanded: controlledExpanded,
  onExpandedChange,
  headerActions,
  children,
}: CollapsibleSectionProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const expanded = controlledExpanded ?? internalExpanded;

  const setExpanded = (next: boolean) => {
    onExpandedChange?.(next);
    if (controlledExpanded === undefined) {
      setInternalExpanded(next);
    }
  };

  return (
    <section className="rounded-xl border border-surface-border bg-surface-card p-5">
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
              {subtitle && <p className="mt-1 text-xs text-content-muted">{subtitle}</p>}
              {summary && (
                <p className="mt-1 text-xs text-accent-blue">
                  {summary}
                  {!expanded && " — クリックで開く"}
                </p>
              )}
            </div>
          </div>
        </button>
        {headerActions && <div className="flex flex-wrap gap-2">{headerActions}</div>}
      </div>
      {expanded && <div className="mt-4">{children}</div>}
    </section>
  );
}
