import { useState } from "react";
import { api } from "../../api/client";
import { isEmailAllowedByEnv } from "../../lib/invite-access";

interface InvitePanelProps {
  userEmail: string | null | undefined;
}

export function InvitePanel({ userEmail }: InvitePanelProps) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isOwner = userEmail ? isEmailAllowedByEnv(userEmail) : false;
  if (!isOwner) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setSending(true);
    setMessage(null);
    setError(null);
    try {
      const res = await api.sendInvite(trimmed);
      setMessage(res.message);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "招待に失敗しました");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="rounded-xl border border-surface-border bg-surface-card p-5">
      <h2 className="mb-1 text-sm font-medium text-slate-300">招待</h2>
      <p className="mb-4 text-xs text-slate-500">
        任意のメールアドレス（Gmail 以外も可）に招待リンクを送ります。相手はメール内のリンクからログインできます。
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="invite-email" className="mb-1 block text-xs text-slate-500">
            メールアドレス
          </label>
          <input
            id="invite-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="guest@example.com"
            className="min-h-[44px] w-full rounded-lg border border-surface-border bg-surface px-3 text-sm text-slate-200"
          />
        </div>
        <button
          type="submit"
          disabled={sending || !email.trim()}
          className="min-h-[44px] shrink-0 rounded-lg bg-accent-blue px-5 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
        >
          {sending ? "送信中…" : "招待を送る"}
        </button>
      </form>

      {message && (
        <p className="mt-3 text-sm text-accent-green">{message}</p>
      )}
      {error && (
        <p className="mt-3 text-sm text-red-300">{error}</p>
      )}
    </section>
  );
}
