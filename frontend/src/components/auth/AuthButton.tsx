import type { User } from "firebase/auth";

interface AuthButtonProps {
  user: User | null;
  loading: boolean;
  signingIn?: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  placement?: "header" | "sidebar";
}

export function AuthButton({
  user,
  loading,
  signingIn = false,
  onSignIn,
  onSignOut,
  placement = "header",
}: AuthButtonProps) {
  if (loading) {
    if (placement === "sidebar") return null;
    return (
      <div
        className="min-h-[44px] min-w-[120px] animate-pulse rounded-lg bg-surface-border"
        aria-hidden
      />
    );
  }

  if (placement === "sidebar") {
    if (!user) return null;
    return (
      <button
        type="button"
        onClick={onSignOut}
        className="flex w-full min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-left font-japanese text-sm text-content-secondary transition hover:bg-surface-hover/60 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue"
      >
        <svg className="h-5 w-5 shrink-0 text-content-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>ログアウト</span>
      </button>
    );
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={onSignIn}
        disabled={signingIn}
        className="min-h-[44px] rounded-lg border border-surface-border bg-surface-card px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-content-muted hover:bg-surface-hover disabled:opacity-50"
      >
        {signingIn ? "ログイン中…" : "Google でログイン"}
      </button>
    );
  }

  return null;
}
