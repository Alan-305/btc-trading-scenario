import { EXTERNAL_LINKS } from "../../lib/external-links";
import {
  fearGreedColor,
  fearGreedLabelJa,
  type FearGreedHistoryPoint,
} from "../../lib/fear-greed";
import { DataPanelMeta } from "../ui/DataPanelMeta";

interface FearGreedMeterProps {
  value: number | null;
  classification?: string;
  updatedAt?: string | null;
  history?: FearGreedHistoryPoint[];
}

function FearGreedGauge({ value }: { value: number }) {
  const cx = 120;
  const cy = 108;
  const r = 78;
  const angle = Math.PI - (value / 100) * Math.PI;
  const needleLen = 58;
  const nx = cx + needleLen * Math.cos(angle);
  const ny = cy - needleLen * Math.sin(angle);
  const color = fearGreedColor(value);

  return (
    <svg viewBox="0 0 240 132" className="mx-auto w-full max-w-[280px]" aria-hidden>
      <defs>
        <linearGradient id="fg-gauge-arc" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#c85d28" />
          <stop offset="45%" stopColor="#e8913a" />
          <stop offset="55%" stopColor="#f1d25c" />
          <stop offset="100%" stopColor="#7ac55d" />
        </linearGradient>
      </defs>
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="url(#fg-gauge-arc)"
        strokeWidth={16}
        strokeLinecap="round"
      />
      <line
        x1={cx}
        y1={cy}
        x2={nx}
        y2={ny}
        stroke="#94a3b8"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <circle cx={nx} cy={ny} r={13} fill={color} />
      <text
        x={nx}
        y={ny + 4}
        textAnchor="middle"
        fill="#fff"
        fontSize={11}
        fontWeight={700}
        className="font-english"
      >
        {value}
      </text>
      <circle cx={cx} cy={cy} r={11} fill="#475569" stroke="#64748b" strokeWidth={2} />
      <text x={cx} y={cy + 4} textAnchor="middle" fill="#f59e0b" fontSize={10} fontWeight={700}>
        ₿
      </text>
      <text x={cx - r - 4} y={cy + 14} textAnchor="middle" fill="#94a3b8" fontSize={9}>
        恐怖
      </text>
      <text x={cx + r + 4} y={cy + 14} textAnchor="middle" fill="#94a3b8" fontSize={9}>
        強欲
      </text>
    </svg>
  );
}

function HistoryRow({ label_ja, value, classification }: FearGreedHistoryPoint) {
  const color = fearGreedColor(value);
  return (
    <li className="flex items-center justify-between gap-3 border-b border-surface-border/60 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="font-japanese text-sm text-slate-300">{label_ja}</p>
        <p className="font-japanese text-xs" style={{ color }}>
          {fearGreedLabelJa(classification)}
        </p>
      </div>
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-english text-sm font-semibold text-white"
        style={{ backgroundColor: color }}
      >
        {value}
      </span>
    </li>
  );
}

export function FearGreedMeter({
  value,
  classification,
  updatedAt,
  history = [],
}: FearGreedMeterProps) {
  const v = value ?? 50;
  const label = fearGreedLabelJa(classification ?? "Neutral");
  const accent = fearGreedColor(v);

  return (
    <div className="flex flex-col gap-4">
      {/* ゲージカード */}
      <article className="rounded-xl border border-surface-border bg-surface-card p-5">
        <DataPanelMeta
          title={
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-lg text-amber-500" aria-hidden>
                ₿
              </span>
              <div>
                <h3 className="font-english text-sm font-semibold text-slate-100">Fear & Greed Index</h3>
                <p className="mt-0.5 font-japanese text-[11px] leading-relaxed text-content-muted">
                  暗号資産市場のセンチメント（複合指標）
                </p>
              </div>
            </div>
          }
          sourceHref={EXTERNAL_LINKS.fearGreed}
          sourceLabel="alternative.me"
          updatedAt={updatedAt}
          className="mb-4"
        />

        <p className="mb-2 text-center font-japanese text-sm text-content-secondary">
          現在:{" "}
          <span className="font-semibold" style={{ color: accent }}>
            {label}
          </span>
        </p>

        <FearGreedGauge value={v} />
      </article>

      {/* 履歴カード */}
      {history.length > 0 && (
        <article className="rounded-xl border border-surface-border bg-surface-card p-5">
          <DataPanelMeta
            title={<h4 className="font-english text-sm font-semibold text-slate-200">Historical Values</h4>}
            subtitle="過去の指数"
            sourceHref={EXTERNAL_LINKS.fearGreed}
            sourceLabel="alternative.me"
            updatedAt={updatedAt}
            className="mb-3"
          />
          <ul>
            {history.map((row) => (
              <HistoryRow key={row.period} {...row} />
            ))}
          </ul>
        </article>
      )}
    </div>
  );
}
