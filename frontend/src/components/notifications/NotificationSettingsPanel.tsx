import { useEffect, useState } from "react";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  setMorningEmailEnabled,
  subscribeNotificationPreferences,
  type NotificationPreferences,
} from "../../lib/firestore-preferences";

interface NotificationSettingsPanelProps {
  userId: string | null | undefined;
}

export function NotificationSettingsPanel({ userId }: NotificationSettingsPanelProps) {
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setPrefs(DEFAULT_NOTIFICATION_PREFERENCES);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = subscribeNotificationPreferences(
      userId,
      (next) => {
        setPrefs(next);
        setLoading(false);
      },
      (message) => {
        setError(message);
        setLoading(false);
      },
    );
    return unsub;
  }, [userId]);

  const handleToggle = async () => {
    if (!userId || saving) return;

    const nextEnabled = !prefs.morningEmailEnabled;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await setMorningEmailEnabled(userId, nextEnabled);
      setSuccess(
        nextEnabled
          ? "毎朝ダイジェストメールの配信を有効にしました。"
          : "毎朝ダイジェストメールの配信を停止しました。",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "設定の保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-surface-border bg-surface-card p-5 sm:p-6">
      <h2 className="font-japanese text-base font-medium text-slate-100">通知設定</h2>
      <p className="mt-2 font-japanese text-sm text-content-secondary">
        毎朝、主要な市場データとシナリオ要約をメールで受け取れます。デフォルトはオフです。
      </p>

      {!userId ? (
        <p className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 font-japanese text-sm text-amber-100">
          通知設定にはログインが必要です。
        </p>
      ) : loading ? (
        <p className="mt-4 font-japanese text-sm text-content-secondary">設定を読み込み中…</p>
      ) : (
        <div className="mt-5 space-y-4">
          <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border border-surface-border bg-surface/60 px-4 py-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-surface-border"
              checked={prefs.morningEmailEnabled}
              disabled={saving}
              onChange={() => void handleToggle()}
            />
            <span className="min-w-0">
              <span className="block font-japanese text-sm font-medium text-slate-100">
                毎朝ダイジェストメールを受け取る
              </span>
              <span className="mt-1 block font-japanese text-xs text-content-muted">
                配信時刻の目安は毎朝 7:00（日本時間）です。メール内のリンクからいつでも配信停止できます。
              </span>
            </span>
          </label>

          <p className="rounded-lg border border-surface-border bg-surface/50 px-4 py-3 font-japanese text-xs text-content-muted">
            本メールは投資助言ではありません。表示内容は参考情報であり、売買判断はご自身の責任で行ってください。
          </p>

          {saving ? (
            <p className="font-japanese text-sm text-content-secondary">保存中…</p>
          ) : null}
          {success ? (
            <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 font-japanese text-sm text-emerald-100">
              {success}
            </p>
          ) : null}
          {error ? (
            <p className="rounded-lg border border-accent-red/50 bg-accent-red/10 px-4 py-3 font-japanese text-sm text-red-200">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
