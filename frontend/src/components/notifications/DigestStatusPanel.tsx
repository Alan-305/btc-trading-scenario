import { useEffect, useState } from "react";
import { api, type DigestLog } from "../../api/client";

interface DigestStatusPanelProps {
  isAdmin: boolean;
}

function formatTimestamp(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP", { hour12: false });
}

export function DigestStatusPanel({ isAdmin }: DigestStatusPanelProps) {
  const [logs, setLogs] = useState<DigestLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    void api
      .getDigestLogs(8)
      .then((res) => {
        if (!cancelled) setLogs(res.logs);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "配信ログの取得に失敗しました。");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  if (!isAdmin) return null;

  return (
    <section className="rounded-xl border border-surface-border bg-surface-card p-5 sm:p-6">
      <h2 className="font-japanese text-base font-medium text-slate-100">毎朝メール配信ログ</h2>
      <p className="mt-2 font-japanese text-sm text-content-secondary">
        直近のダイジェスト配信結果です。失敗がある場合は Resend の設定や API キーを確認してください。
      </p>

      {loading ? (
        <p className="mt-4 font-japanese text-sm text-content-secondary">ログを読み込み中…</p>
      ) : error ? (
        <p className="mt-4 rounded-lg border border-accent-red/50 bg-accent-red/10 px-4 py-3 font-japanese text-sm text-red-200">
          {error}
        </p>
      ) : logs.length === 0 ? (
        <p className="mt-4 font-japanese text-sm text-content-secondary">配信ログはまだありません。</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse font-japanese text-xs text-content-secondary">
            <thead>
              <tr className="border-b border-surface-border text-left text-content-muted">
                <th className="px-2 py-2">開始</th>
                <th className="px-2 py-2">状態</th>
                <th className="px-2 py-2">登録者</th>
                <th className="px-2 py-2">送信</th>
                <th className="px-2 py-2">失敗</th>
                <th className="px-2 py-2">基準価格</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-surface-border/60">
                  <td className="px-2 py-2 whitespace-nowrap">{formatTimestamp(log.startedAt)}</td>
                  <td className="px-2 py-2">{log.status ?? "—"}{log.dryRun ? " (dry)" : ""}</td>
                  <td className="px-2 py-2">{log.subscribersTotal ?? 0}</td>
                  <td className="px-2 py-2">{log.sent ?? 0}</td>
                  <td className="px-2 py-2">{log.failed ?? 0}</td>
                  <td className="px-2 py-2 font-english">
                    {typeof log.referencePrice === "number" ? `$${log.referencePrice.toLocaleString()}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
