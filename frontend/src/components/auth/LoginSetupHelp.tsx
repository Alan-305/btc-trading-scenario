interface LoginSetupHelpProps {
  localDev: boolean;
}

export function LoginSetupHelp({ localDev }: LoginSetupHelpProps) {
  if (!localDev) return null;

  return (
    <div className="mx-auto max-w-md rounded-lg border border-surface-border bg-surface-card p-4 text-sm text-slate-400">
      <p className="font-medium text-slate-200">ローカル開発</p>
      <p className="mt-2">
        本番と同じく <span className="text-slate-300">Google でログイン</span>{" "}
        を使います。招待された Google アカウント（例: matsuo@nexus-learning.com）で入ってください。
      </p>
    </div>
  );
}
