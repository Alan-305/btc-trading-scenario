import { useState } from "react";
import { api } from "../../api/client";

export type SupportCategory = "bug" | "feature" | "account" | "other";

const CATEGORY_OPTIONS: { value: SupportCategory; label: string }[] = [
  { value: "bug", label: "不具合・エラー" },
  { value: "feature", label: "機能の要望" },
  { value: "account", label: "アカウント・ログイン" },
  { value: "other", label: "その他" },
];

interface SupportPanelProps {
  userEmail: string | null | undefined;
}

export function SupportPanel({ userEmail }: SupportPanelProps) {
  const [category, setCategory] = useState<SupportCategory>("bug");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = Boolean(userEmail) && subject.trim().length > 0 && message.trim().length >= 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || sending) return;

    setSending(true);
    setSuccess(null);
    setError(null);
    try {
      const res = await api.sendSupport({
        category,
        subject: subject.trim(),
        message: message.trim(),
      });
      setSuccess(res.message);
      setSubject("");
      setMessage("");
      setCategory("bug");
    } catch (err) {
      setError(err instanceof Error ? err.message : "送信に失敗しました。");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="mx-auto max-w-2xl rounded-xl border border-surface-border bg-surface-card p-5 sm:p-6">
      <h2 className="font-japanese text-base font-medium text-slate-100">サポート</h2>
      <p className="mt-2 font-japanese text-sm text-content-secondary">
        不具合の報告やご質問はこちらからお送りください。内容は{" "}
        <span className="font-english text-slate-200">support@nexus-learning.com</span>{" "}
        宛に届きます。
      </p>

      {!userEmail ? (
        <p className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 font-japanese text-sm text-amber-100">
          お問い合わせにはログインが必要です。
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="support-reply-email" className="mb-1 block font-japanese text-xs text-content-muted">
              返信先メール
            </label>
            <input
              id="support-reply-email"
              type="email"
              readOnly
              value={userEmail}
              className="min-h-[44px] w-full cursor-default rounded-lg border border-surface-border bg-surface/80 px-3 font-english text-sm text-content-secondary"
            />
          </div>

          <div>
            <label htmlFor="support-category" className="mb-1 block font-japanese text-xs text-content-muted">
              カテゴリ
            </label>
            <select
              id="support-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as SupportCategory)}
              className="min-h-[44px] w-full rounded-lg border border-surface-border bg-surface px-3 font-japanese text-sm text-slate-200"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="support-subject" className="mb-1 block font-japanese text-xs text-content-muted">
              件名
            </label>
            <input
              id="support-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
              maxLength={200}
              placeholder="例: エントリーチャートが表示されない"
              className="min-h-[44px] w-full rounded-lg border border-surface-border bg-surface px-3 font-japanese text-sm text-slate-200"
            />
          </div>

          <div>
            <label htmlFor="support-message" className="mb-1 block font-japanese text-xs text-content-muted">
              お問い合わせ内容
            </label>
            <textarea
              id="support-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              maxLength={5000}
              placeholder="状況・再現手順・ご要望などを具体的にご記入ください（10文字以上）"
              className="w-full resize-y rounded-lg border border-surface-border bg-surface px-3 py-3 font-japanese text-sm text-slate-200"
            />
            <p className="mt-1 font-japanese text-[10px] text-content-muted">
              {message.trim().length} / 5000 文字（10文字以上）
            </p>
          </div>

          <button
            type="submit"
            disabled={sending || !canSubmit}
            className="min-h-[44px] w-full rounded-lg bg-accent-blue px-5 py-2.5 font-japanese text-sm font-medium text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {sending ? "送信中…" : "送信する"}
          </button>
        </form>
      )}

      {success ? (
        <p className="mt-4 rounded-lg border border-accent-green/40 bg-accent-green/10 px-4 py-3 font-japanese text-sm text-accent-green">
          {success}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-lg border border-accent-red/40 bg-accent-red/10 px-4 py-3 font-japanese text-sm text-red-200">
          {error}
        </p>
      ) : null}
    </section>
  );
}
