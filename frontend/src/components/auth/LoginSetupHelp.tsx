interface LoginSetupHelpProps {
  localDev: boolean;
}

export function LoginSetupHelp({ localDev }: LoginSetupHelpProps) {
  if (!localDev) return null;

  return (
    <div className="mx-auto max-w-md rounded-lg border border-surface-border bg-surface-card p-4 text-sm text-content-secondary">
      <p className="font-medium text-slate-200">ローカル開発</p>
      <p className="mt-2">
        本番と同じく <span className="text-slate-300">Google でログイン</span>{" "}
        を使います。
      </p>
    </div>
  );
}
