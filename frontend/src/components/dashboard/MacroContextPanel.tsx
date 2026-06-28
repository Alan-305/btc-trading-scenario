import type { MacroContextSnapshot } from "../../types/scenario";
import { ExternalLink } from "../ui/ExternalLink";

interface MacroContextPanelProps {
  data: MacroContextSnapshot | null;
  loading?: boolean;
}

function formatUsd(n: number | null | undefined): string {
  if (n == null) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const ETF_TREND_LABEL: Record<string, string> = {
  inflow: "流入傾向",
  outflow: "流出傾向",
  neutral: "中立",
};

const ACTIVITY_LABEL: Record<string, string> = {
  rising: "活発化",
  falling: "減速",
  stable: "横ばい",
};

export function MacroContextPanel({ data, loading }: MacroContextPanelProps) {
  if (loading && !data) {
    return (
      <div className="rounded-xl border border-surface-border bg-surface-card p-5">
        <h3 className="font-japanese text-sm font-medium text-slate-400">マクロ環境</h3>
        <p className="mt-3 text-sm text-slate-500">読み込み中…</p>
      </div>
    );
  }

  if (!data || (!data.options && !data.etf_flows && !data.onchain)) {
    return (
      <div className="rounded-xl border border-surface-border bg-surface-card p-5">
        <h3 className="font-japanese text-sm font-medium text-slate-400">マクロ環境</h3>
        <p className="mt-3 text-sm text-slate-500">データなし</p>
      </div>
    );
  }

  const { options, etf_flows, onchain } = data;

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-5">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-japanese text-sm font-medium text-slate-300">マクロ環境</h3>
          <p className="mt-1 font-japanese text-[11px] text-slate-500">
            ETF資金・オプション・オンチェーン（シナリオ分析に反映）
          </p>
        </div>
        <ExternalLink href="https://www.deribit.com/statistics/BTC/options-data" className="shrink-0 text-xs">
          Deribit
        </ExternalLink>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {etf_flows && (
          <div className="rounded-lg border border-surface-border/70 bg-surface/40 p-3">
            <p className="font-japanese text-[10px] text-slate-500">米国BTC ETF（推定）</p>
            <p className="mt-1 font-japanese text-sm font-medium text-white">
              {ETF_TREND_LABEL[etf_flows.trend] ?? etf_flows.trend}
            </p>
            <p className="mt-2 font-english text-xs text-slate-400">
              3日合計 {formatUsd(etf_flows.net_flow_3d_usd)}
            </p>
            <p className="font-japanese text-[10px] text-slate-600">
              {etf_flows.tickers_tracked.slice(0, 3).join("・")} ほか
            </p>
          </div>
        )}

        {options && (
          <div className="rounded-lg border border-surface-border/70 bg-surface/40 p-3">
            <p className="font-japanese text-[10px] text-slate-500">Deribit オプション</p>
            <p className="mt-1 font-english text-sm font-medium text-white">
              P/C {options.put_call_ratio.toFixed(2)}
            </p>
            <p className="mt-2 font-english text-xs text-slate-400">
              DVOL {options.dvol_index != null ? options.dvol_index.toFixed(1) : "—"}
            </p>
            <p className="font-japanese text-[10px] text-slate-600">
              Put OI {options.put_open_interest.toLocaleString()} / Call{" "}
              {options.call_open_interest.toLocaleString()}
            </p>
          </div>
        )}

        {onchain && (
          <div className="rounded-lg border border-surface-border/70 bg-surface/40 p-3">
            <p className="font-japanese text-[10px] text-slate-500">オンチェーン</p>
            <p className="mt-1 font-japanese text-sm font-medium text-white">
              {ACTIVITY_LABEL[onchain.activity_trend] ?? onchain.activity_trend}
            </p>
            <p className="mt-2 font-english text-xs text-slate-400">
              ハッシュレート 7日{" "}
              {onchain.hash_rate_change_7d_pct != null
                ? `${onchain.hash_rate_change_7d_pct > 0 ? "+" : ""}${onchain.hash_rate_change_7d_pct}%`
                : "—"}
            </p>
            <p className="font-japanese text-[10px] text-slate-600">
              手数料（速い） {onchain.mempool_fast_fee_sat ?? "—"} sat/vB
            </p>
          </div>
        )}
      </div>

      <p className="mt-3 font-japanese text-[10px] leading-relaxed text-slate-600">
        ETFは{etf_flows?.source === "coinglass" ? "Coinglass" : "Yahoo出来高×価格変動"}の推定です。
        参考情報であり投資助言ではありません。
      </p>
    </div>
  );
}
