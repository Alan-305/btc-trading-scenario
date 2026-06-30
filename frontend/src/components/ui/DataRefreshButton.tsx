interface DataRefreshButtonProps {
  onClick: () => void;
  loading?: boolean;
  label?: string;
  className?: string;
}

export function DataRefreshButton({
  onClick,
  loading = false,
  label = "データを更新",
  className = "",
}: DataRefreshButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-label={label}
      title={label}
      className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-surface-border text-content-muted transition hover:border-content-muted hover:bg-surface-hover/50 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 4v6h6M20 20v-6h-6M5.6 18.4A8 8 0 1 0 6 5.3M18.4 5.6A8 8 0 1 1 18 18.7"
        />
      </svg>
    </button>
  );
}
