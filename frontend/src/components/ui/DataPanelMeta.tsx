import type { ReactNode } from "react";
import { formatDataUpdatedAt } from "../../lib/format-data-updated";
import { ExternalLink } from "./ExternalLink";

interface DataPanelMetaProps {
  title: ReactNode;
  subtitle?: ReactNode;
  sourceHref?: string;
  sourceLabel?: string;
  updatedAt?: string | Date | null;
  headerActions?: ReactNode;
  titleClassName?: string;
  className?: string;
}

export function DataPanelMeta({
  title,
  subtitle,
  sourceHref,
  sourceLabel,
  updatedAt,
  headerActions,
  titleClassName = "font-japanese text-sm font-medium text-slate-200",
  className = "mb-3",
}: DataPanelMetaProps) {
  return (
    <header className={className}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {typeof title === "string" ? <h3 className={titleClassName}>{title}</h3> : title}
          {subtitle ? (
            <p className="mt-0.5 font-japanese text-[11px] leading-relaxed text-content-muted">
              {subtitle}
            </p>
          ) : null}
        </div>
        {(headerActions || sourceHref) && (
          <div className="flex shrink-0 flex-col items-end gap-2">
            {headerActions}
            {sourceHref && sourceLabel ? (
              <ExternalLink href={sourceHref} className="text-xs">
                {sourceLabel}
              </ExternalLink>
            ) : null}
          </div>
        )}
      </div>
      {updatedAt != null ? (
        <DataUpdatedAt value={updatedAt} className="mt-2" />
      ) : null}
    </header>
  );
}

interface DataUpdatedAtProps {
  value?: string | Date | null;
  className?: string;
}

export function DataUpdatedAt({ value, className = "mt-3" }: DataUpdatedAtProps) {
  if (!value) return null;
  return (
    <p className={`font-japanese text-[10px] text-content-muted ${className}`}>
      最終更新: {formatDataUpdatedAt(value)}
    </p>
  );
}
