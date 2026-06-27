interface LoginSetupHelpProps {
  localDev: boolean;
  devCredentialsReady: boolean;
}

export function LoginSetupHelp({ localDev, devCredentialsReady }: LoginSetupHelpProps) {
  if (!localDev) return null;

  if (devCredentialsReady) {
    return (
      <div className="mb-4 rounded-lg border border-surface-border bg-surface-card p-3 text-sm text-slate-400">
        ローカル開発ではメール/パスワードでログインします（Google ポップアップは使いません）。
        右上の <span className="text-slate-300">ログイン</span> を押してください。
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-accent-amber/50 bg-accent-amber/10 p-4 text-sm text-amber-100">
      <p className="font-medium">初回セットアップ（1 回だけ）</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-amber-50/90">
        <li>
          Firebase Console → Authentication → Sign-in method →
          <span className="text-white"> メール/パスワードを有効化</span>
        </li>
        <li>Authentication → Users → ユーザーを追加（メールとパスワード）</li>
        <li>
          <code className="text-xs">frontend/.env.local</code> に以下を追加して Vite を再起動
          <pre className="mt-2 overflow-x-auto rounded bg-black/30 p-2 text-xs text-slate-200">
{`VITE_DEV_LOGIN_EMAIL=あなたのメール
VITE_DEV_LOGIN_PASSWORD=あなたのパスワード`}
          </pre>
        </li>
      </ol>
    </div>
  );
}
