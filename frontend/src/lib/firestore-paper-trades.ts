import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  type Timestamp as FirestoreTimestamp,
} from "firebase/firestore";
import type { PaperTrade, PaperTradeInput, PaperTradeStatus, PaperTradeTakeProfitTarget } from "../types/paper-trade";
import { realizedPnlFromExit } from "./paper-trade-math";
import { getFirebaseDb } from "./firebase";

export const PAPER_TRADE_RETENTION_DAYS = 365;
export const PAPER_TRADE_QUERY_LIMIT = 200;

function paperTradeCollection(uid: string) {
  return collection(getFirebaseDb(), "users", uid, "paperTrades");
}

function num(data: Record<string, unknown>, key: string): number | null {
  const v = data[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function mapDoc(id: string, data: Record<string, unknown>): PaperTrade {
  const opened = data.openedAt as FirestoreTimestamp | undefined;
  const closed = data.closedAt as FirestoreTimestamp | undefined;
  const updated = data.updatedAt as FirestoreTimestamp | undefined;
  return {
    id,
    side: (data.side as PaperTrade["side"]) ?? "long",
    status: (data.status as PaperTradeStatus) ?? "open",
    entryPrice: num(data, "entryPrice") ?? 0,
    sizeBtc: num(data, "sizeBtc") ?? 0,
    stopLoss: num(data, "stopLoss") ?? 0,
    takeProfit1: num(data, "takeProfit1"),
    takeProfit2: num(data, "takeProfit2"),
    takeProfitTarget:
      data.takeProfitTarget === "tp2" ? "tp2" : ("tp1" as PaperTradeTakeProfitTarget),
    exitPrice: num(data, "exitPrice"),
    realizedPnlUsd: num(data, "realizedPnlUsd"),
    label: (data.label as string) ?? "",
    scenarioBranch: (data.scenarioBranch as string | null) ?? null,
    horizonId: (data.horizonId as string | null) ?? null,
    openedAt: opened?.toDate() ?? null,
    closedAt: closed?.toDate() ?? null,
    updatedAt: updated?.toDate() ?? null,
  };
}

export async function createPaperTrade(uid: string, input: PaperTradeInput): Promise<string> {
  const docRef = await addDoc(paperTradeCollection(uid), {
    ...input,
    status: "open",
    exitPrice: null,
    realizedPnlUsd: null,
    openedAt: serverTimestamp(),
    closedAt: null,
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export interface PaperTradeEditableFields {
  entryPrice: number;
  sizeBtc: number;
  stopLoss: number;
  takeProfit1: number | null;
  takeProfit2: number | null;
  takeProfitTarget: PaperTradeTakeProfitTarget;
  label: string;
}

export async function updatePaperTradeFields(
  uid: string,
  tradeId: string,
  fields: PaperTradeEditableFields,
): Promise<void> {
  await updateDoc(doc(paperTradeCollection(uid), tradeId), {
    ...fields,
    updatedAt: serverTimestamp(),
  });
}

export async function closePaperTrade(
  uid: string,
  tradeId: string,
  exitPrice: number,
  status: Exclude<PaperTradeStatus, "open">,
  trade: Pick<PaperTrade, "side" | "entryPrice" | "sizeBtc">,
): Promise<void> {
  const realizedPnlUsd = realizedPnlFromExit(
    trade.side,
    trade.entryPrice,
    exitPrice,
    trade.sizeBtc,
  );
  await updateDoc(doc(paperTradeCollection(uid), tradeId), {
    status,
    exitPrice,
    realizedPnlUsd,
    closedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function deletePaperTrade(uid: string, tradeId: string): Promise<void> {
  await deleteDoc(doc(paperTradeCollection(uid), tradeId));
}

export async function deletePaperTrades(uid: string, tradeIds: string[]): Promise<void> {
  const uniqueIds = [...new Set(tradeIds)];
  if (uniqueIds.length === 0) return;
  await Promise.all(uniqueIds.map((id) => deletePaperTrade(uid, id)));
}

export function subscribePaperTrades(
  uid: string,
  onData: (records: PaperTrade[]) => void,
  onError: (message: string) => void,
): () => void {
  const cutoff = Timestamp.fromDate(
    new Date(Date.now() - PAPER_TRADE_RETENTION_DAYS * 24 * 60 * 60 * 1000),
  );
  const q = query(
    paperTradeCollection(uid),
    orderBy("openedAt", "desc"),
    limit(PAPER_TRADE_QUERY_LIMIT),
  );

  return onSnapshot(
    q,
    (snap) => {
      const records = snap.docs
        .map((d) => mapDoc(d.id, d.data()))
        .filter((t) => t.openedAt == null || t.openedAt >= cutoff.toDate());
      onData(records);
    },
    (err) => onError(err.message),
  );
}
