import type {
  ActivityLevel,
  MarketSessionsResponse,
  MarketSessionBlock,
} from "../../types/sessions";

const ACTIVITY_BG: Record<ActivityLevel, string> = {
  low: "bg-slate-700/40",
  medium: "bg-blue-600/50",
  high: "bg-amber-500/60",
  peak: "bg-emerald-500/70",
};

const SESSION_STATUS_LABEL = {
  active: "稼働中",
  upcoming: "まもなく",
  closed: "オフ",
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
        : "text-slate-500";

  return (
    <div
      className={`rounded-lg border p-4 ${
        session.status === "active"
          ? "border-accent-blue/40 bg-slate-800/80"
          : "border-surface-border bg-surface-card"
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <h4 className="font-japanese text-sm font-medium text-slate-200">{session.name_ja}</h4>
        <span className={`text-xs ${statusColor}`}>{SESSION_STATUS_LABEL[session.status]}</span>
      </div>
      <p className="mb-2 text-xs text-slate-500">{session.centers_ja}</p>
      <dl className="space-y-1 text-xs text-slate-400">
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
        {session.linked_exchanges.includes("bitbank") && (
          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300">
            bitbank
          </span>
        )}
      </div>
    </div>
  );
}

export function MarketSessionsPanel({ data }: MarketSessionsPanelProps) {
  const orderedSessions = SESSION_ORDER.map(
    (id) => data.sessions.find((s) => s.id === id)!
  ).filter(Boolean);

  return (
    <section className="rounded-xl border border-surface-border bg-surface-card p-5">
      <h2 className="mb-4 font-japanese text-sm font-medium text-slate-300">
        世界市場の時間帯
      </h2>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {data.clocks.map((c) => (
          <div
            key={c.timezone}
            className="rounded-lg border border-surface-border bg-slate-900/50 px-3 py-2 text-center"
          >
            <p className="text-xs text-slate-500">{c.label_ja}</p>
            <p className="font-english text-xl font-semibold text-white">
              {c.time_hm}
              <span className="ml-1 text-sm font-normal text-slate-400">({c.weekday_ja})</span>
            </p>
          </div>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {orderedSessions.map((s) => (
          <SessionCard key={s.id} session={s} />
        ))}
      </div>

      <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
        <span>24時間タイムライン（日本時間）</span>
        <span>
          <span className="mr-2 inline-block h-2 w-2 rounded-sm bg-emerald-500/70" />
          活発
          <span className="mx-2 inline-block h-2 w-2 rounded-sm bg-slate-700/40" />
          静か
        </span>
      </div>
      <div className="mb-1 grid grid-cols-24 gap-px" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
        {data.timeline_jst.map((h) => (
          <div
            key={h.jst_hour}
            className={`relative aspect-[2/3] rounded-sm ${ACTIVITY_BG[h.activity_level]} ${
              h.is_now ? "ring-2 ring-white ring-offset-1 ring-offset-slate-900" : ""
            }`}
            title={`${h.jst_label} ${h.active_sessions.join("/") || "off"}`}
          >
            {h.good_for_whitebit && (
              <span className="absolute -top-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-blue-400" />
            )}
            {h.good_for_bitbank && (
              <span className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-amber-400" />
            )}
          </div>
        ))}
      </div>
      <div className="mb-4 flex justify-between font-english text-[10px] text-slate-600">
        <span>0時</span>
        <span>6時</span>
        <span>12時</span>
        <span>18時</span>
        <span>24時</span>
      </div>
      <p className="mb-4 text-[10px] text-slate-500">
        上の点=WhiteBIT向き / 下の点=bitbank向き　白枠=現在時刻
      </p>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {data.exchanges.map((ex) => (
          <div key={ex.exchange} className="rounded-lg bg-slate-800/50 p-3 text-xs">
            <p className="font-english font-medium text-slate-300">{ex.name_ja}</p>
            <p className="mt-1 font-japanese leading-relaxed text-slate-400">{ex.note_ja}</p>
          </div>
        ))}
      </div>

      <article className="rounded-lg border border-accent-blue/30 bg-accent-blue/10 p-4">
        <h3 className="mb-1 text-sm font-medium text-accent-blue">エントリー時間帯の目安</h3>
        <p className="font-japanese text-sm leading-relaxed text-slate-200">
          {data.entry_hint.summary_ja}
        </p>
        <p className="mt-2 font-japanese text-xs leading-relaxed text-slate-400">
          {data.entry_hint.detail_ja}
        </p>
        {data.entry_hint.next_high_activity_jst && (
          <p className="mt-2 font-japanese text-xs text-slate-500">
            次の活発な時間帯: {data.entry_hint.next_high_activity_jst}
          </p>
        )}
      </article>
    </section>
  );
}
