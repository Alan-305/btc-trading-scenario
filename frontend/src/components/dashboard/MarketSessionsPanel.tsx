import type {
  ActivityLevel,
  MarketSessionsResponse,
  MarketSessionBlock,
  MarketHourState,
  MarketStatusCode,
} from "../../types/sessions";

/** 青=静か / オレンジ=やや活発 / 赤=活発 */
const ACTIVITY_BG: Record<ActivityLevel, string> = {
  low: "bg-blue-600/45",
  medium: "bg-orange-500/55",
  high: "bg-red-500/65",
  peak: "bg-red-600/80",
};

const SESSION_STATUS_LABEL = {
  active: "稼働中",
  upcoming: "まもなく",
  closed: "オフ",
};

const MARKET_DOT: Record<MarketStatusCode, string> = {
  open: "bg-emerald-400",
  off_hours: "bg-slate-500",
  weekend: "bg-slate-600",
  holiday: "bg-amber-400",
};

const MARKET_LABEL: Record<string, string> = {
  japan: "日",
  europe: "欧",
  us: "米",
};

const SESSION_ORDER = ["asia", "europe", "us"];

interface MarketSessionsPanelProps {
  data: MarketSessionsResponse;
}

function SessionCard({ session }: { session: MarketSessionBlock }) {
  const statusColor =
    session.status === "active"
      ? "text-accent-green"
      : session.status === "upcoming"
        ? "text-accent-amber"
        : "text-content-muted";

  return (
    <div
      className={`rounded-lg border p-4 ${
        session.status === "active"
          ? "border-accent-blue/40 bg-surface-hover/80"
          : "border-surface-border bg-surface-card"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="font-japanese text-sm font-medium text-slate-200">{session.name_ja}</h4>
        <span className={`text-xs ${statusColor}`}>{SESSION_STATUS_LABEL[session.status]}</span>
      </div>
      <p className="mb-2 text-xs text-content-muted">{session.centers_ja}</p>
      {session.stock_market_note_ja && (
        <p className="mb-2 rounded bg-surface-hover/80 px-2 py-1 text-[10px] text-amber-200">
          株式: {session.stock_market_note_ja}
        </p>
      )}
      <dl className="space-y-1 text-xs text-content-secondary">
        <div className="flex justify-between font-english">
          <dt>JST</dt>
          <dd>
            {session.jst_start_hm} – {session.jst_end_hm}
          </dd>
        </div>
        <div className="flex justify-between font-english">
          <dt>UTC</dt>
          <dd>
            {session.utc_start_hm} – {session.utc_end_hm}
          </dd>
        </div>
      </dl>
      <div className="mt-2 flex flex-wrap gap-1">
        {session.linked_exchanges.includes("whitebit") && (
          <span className="rounded bg-accent-blue/20 px-1.5 py-0.5 text-[10px] text-accent-blue">
            WhiteBIT
          </span>
        )}
        {session.linked_exchanges.includes("bybit") && (
          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300">
            Bybit
          </span>
        )}
        {session.linked_exchanges.includes("bitget") && (
          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300">
            Bitget
          </span>
        )}
      </div>
    </div>
  );
}

function MarketDots({ markets }: { markets: MarketHourState[] }) {
  const ordered = ["japan", "europe", "us"].map(
    (id) => markets.find((m) => m.market_id === id)!,
  ).filter(Boolean);

  return (
    <div className="mt-0.5 flex justify-center gap-px">
      {ordered.map((m) => (
        <span
          key={m.market_id}
          className={`h-1 w-1 rounded-full ${MARKET_DOT[m.status]}`}
          title={`${m.name_ja}: ${m.status}`}
        />
      ))}
    </div>
  );
}

function timelineTooltip(h: MarketSessionsResponse["timeline_jst"][number]): string {
  const parts = [
    h.jst_label,
    `稼働 ${h.open_market_count}/3 市場`,
    h.closure_summary_ja ?? "全時間帯通常",
  ];
  const marketDetail = h.markets
    .map((m) => `${MARKET_LABEL[m.market_id] ?? m.market_id}=${m.status}`)
    .join(" ");
  return `${parts.join(" · ")} (${marketDetail})`;
}

export function MarketSessionsPanel({ data }: MarketSessionsPanelProps) {
  const orderedSessions = SESSION_ORDER.map(
    (id) => data.sessions.find((s) => s.id === id)!,
  ).filter(Boolean);

  return (
    <section className="rounded-xl border border-surface-border bg-surface-card p-5">
      <h2 className="mb-1 font-japanese text-sm font-medium text-slate-300">
        世界市場の時間帯
      </h2>
      <p className="mb-4 text-xs leading-relaxed text-content-muted">{data.timeline_caption_ja}</p>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {data.clocks.map((c) => (
          <div
            key={c.timezone}
            className="rounded-lg border border-surface-border bg-surface-elevated/50 px-3 py-2 text-center"
          >
            <p className="text-xs text-content-muted">{c.label_ja}</p>
            <p className="font-english text-xl font-semibold text-white">
              {c.time_hm}
              <span className="ml-1 text-sm font-normal text-content-secondary">({c.weekday_ja})</span>
            </p>
            {c.market_note_ja && (
              <p className="mt-1 text-[10px] text-amber-200">{c.market_note_ja}</p>
            )}
          </div>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {orderedSessions.map((s) => (
          <SessionCard key={s.id} session={s} />
        ))}
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-content-muted">
        <span>24時間タイムライン（日本時間・株式市場ベース）</span>
        <span className="flex flex-wrap items-center gap-3">
          <span>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-red-600/80" />
            活発
          </span>
          <span>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-orange-500/55" />
            やや活発
          </span>
          <span>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-blue-600/45" />
            静か
          </span>
        </span>
      </div>
      <div
        className="mb-1 grid grid-cols-24 gap-px"
        style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}
      >
        {data.timeline_jst.map((h) => (
          <div
            key={h.jst_hour}
            className={`relative rounded-sm ${ACTIVITY_BG[h.activity_level]} ${
              h.is_now ? "ring-2 ring-white ring-offset-1 ring-offset-black" : ""
            } ${h.closure_summary_ja ? "opacity-90" : ""}`}
            title={timelineTooltip(h)}
          >
            <div className="flex aspect-[2/3] flex-col items-stretch justify-end px-px pb-0.5 pt-1">
              {h.good_for_whitebit && (
                <span className="mx-auto mb-auto h-1 w-1 rounded-full bg-blue-200" />
              )}
              <MarketDots markets={h.markets} />
              {h.good_for_asia && (
                <span className="mx-auto mt-auto h-1 w-1 rounded-full bg-amber-200" />
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mb-4 flex justify-between font-english text-[10px] text-content-muted">
        <span>0時</span>
        <span>6時</span>
        <span>12時</span>
        <span>18時</span>
        <span>24時</span>
      </div>
      <p className="mb-4 text-[10px] leading-relaxed text-content-muted">
        棒の色＝日・欧・米の株式市場が同時に開いている数（東証・ロンドン・NYSE の営業時間・土日・祝日を反映）
        <br />
        下の点（左から日・欧・米）:
        <span className="mx-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 align-middle" />
        稼働
        <span className="mx-1 inline-block h-1.5 w-1.5 rounded-full bg-slate-500 align-middle" />
        時間外
        <span className="mx-1 inline-block h-1.5 w-1.5 rounded-full bg-slate-600 align-middle" />
        土日
        <span className="mx-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-400 align-middle" />
        祝日
        <br />
        上の点=WhiteBIT向き / 下の点=アジア取引所向き　白枠=現在時刻
      </p>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {data.exchanges.map((ex) => (
          <div key={ex.exchange} className="rounded-lg bg-surface-hover/50 p-3 text-xs">
            <p className="font-english font-medium text-slate-300">{ex.name_ja}</p>
            <p className="mt-1 font-japanese leading-relaxed text-content-secondary">{ex.note_ja}</p>
          </div>
        ))}
      </div>

      <article className="rounded-lg border border-accent-blue/30 bg-accent-blue/10 p-4">
        <h3 className="mb-1 text-sm font-medium text-accent-blue">エントリー時間帯の目安</h3>
        <p className="font-japanese text-sm leading-relaxed text-slate-200">
          {data.entry_hint.summary_ja}
        </p>
        <p className="mt-2 font-japanese text-xs leading-relaxed text-content-secondary">
          {data.entry_hint.detail_ja}
        </p>
        {data.entry_hint.next_high_activity_jst && (
          <p className="mt-2 font-japanese text-xs text-content-muted">
            次の活発な時間帯: {data.entry_hint.next_high_activity_jst}
          </p>
        )}
      </article>
    </section>
  );
}
