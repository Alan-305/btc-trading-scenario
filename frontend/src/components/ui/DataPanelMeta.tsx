import type { ReactNode } from "react";
import type { DataRefreshProps } from "../../types/data-refresh";
import { formatDataUpdatedAt } from "../../lib/format-data-updated";
import { DataRefreshButton } from "./DataRefreshButton";
import { ExternalLink } from "./ExternalLink";

interface DataPanelMetaProps extends DataRefreshProps {
  title: ReactNode;
  subtitle?: ReactNode;
  sourceHref?: string;
  sourceLabel?: string;
  updatedAt?: string | Date | null;
  headerActions?: ReactNode;
  titleClassName?: string;
  className?: string;
  refreshLabel?: string;
}

export function DataPanelMeta({
  title,
  subtitle,
  sourceHref,
  sourceLabel,
  updatedAt,
  headerActions,
  onRefresh,
  refreshing = false,
  refreshLabel,
  titleClassName = "font-japanese text-sm font-medium text-slate-200",
  className = "mb-3",
}: DataPanelMetaProps) {
  const showToolbar = headerActions || onRefresh || sourceHref;

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
        {showToolbar ? (
          <div className="flex shrink-0 flex-col items-end gap-2">
            {headerActions}
            {(onRefresh || sourceHref) && (
              <div className="flex items-center gap-1">
                {onRefresh ? (
                  <DataRefreshButton
                    onClick={onRefresh}
                    loading={refreshing}
                    label={refreshLabel}
                  />
                ) : null}
                {sourceHref && sourceLabel ? (
                  <ExternalLink href={sourceHref} className="text-xs">
                    {sourceLabel}
                  </ExternalLink>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
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

/** リンク行の外に置くリロード＋リンク（ScenarioCard など） */
export function DataSourceActions({
  sourceHref,
  sourceLabel,
  onRefresh,
  refreshing = false,
  refreshLabel,
  className = "flex items-center gap-1",
}: {
  sourceHref?: string;
  sourceLabel?: string;
  refreshLabel?: string;
  className?: string;
} & DataRefreshProps) {
  if (!onRefresh && !sourceHref) return null;
  return (
    <div className={className}>
      {onRefresh ? (
        <DataRefreshButton onClick={onRefresh} loading={refreshing} label={refreshLabel} />
      ) : null}
      {sourceHref && sourceLabel ? (
        <ExternalLink href={sourceHref} className="text-xs">
          {sourceLabel}
        </ExternalLink>
      ) : null}
    </div>
  );
}
