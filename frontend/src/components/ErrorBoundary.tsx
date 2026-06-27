import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("UI error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-surface px-4">
          <div className="max-w-lg rounded-xl border border-accent-red/50 bg-surface-card p-6">
            <h1 className="text-lg font-medium text-red-200">画面の読み込みに失敗しました</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">{this.state.error.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 min-h-[44px] rounded-lg bg-accent-blue px-4 py-2 text-sm text-white"
            >
              再読み込み
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
