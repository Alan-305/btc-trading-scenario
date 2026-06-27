import type { User } from "firebase/auth";

interface AuthButtonProps {
  user: User | null;
  loading: boolean;
  signingIn?: boolean;
  localDev?: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

export function AuthButton({
  user,
  loading,
  signingIn = false,
  localDev = true,
  onSignIn,
  onSignOut,
}: AuthButtonProps) {
  if (loading) {
    return (
      <div
        className="min-h-[44px] min-w-[120px] animate-pulse rounded-lg bg-surface-border"
        aria-hidden
      />
    );
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={onSignIn}
        disabled={signingIn}
        className="min-h-[44px] rounded-lg border border-surface-border bg-surface-card px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 disabled:opacity-50"
      >
        {signingIn ? "ログイン中…" : localDev ? "ログイン" : "Google でログイン"}
      </button>
    );
  }

  const label = user.displayName ?? user.email ?? "ログイン中";

  return (
    <div className="flex items-center gap-2">
      <span className="hidden max-w-[200px] truncate text-xs text-slate-400 sm:inline" title={label}>
        {label}
      </span>
      <button
        type="button"
        onClick={onSignOut}
        className="min-h-[44px] rounded-lg border border-surface-border px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:bg-slate-800"
      >
        ログアウト
      </button>
    </div>
  );
}
