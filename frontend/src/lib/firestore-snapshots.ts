import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  Timestamp,
  type Timestamp as FirestoreTimestamp,
} from "firebase/firestore";
import type { MarketSnapshot, ScenarioResponse } from "../types/scenario";
import { getFirebaseDb } from "./firebase";

export interface SavedSnapshotRecord {
  id: string;
  scenario: ScenarioResponse;
  market_summary: {
    whitebit_price: string | null;
    divergence_pct: Record<string, number>;
    collected_at: string;
  };
  saved_at: Date | null;
}

interface SaveSnapshotInput {
  uid: string;
  scenario: ScenarioResponse;
  snapshot: MarketSnapshot | null;
}

export const SNAPSHOT_RETENTION_DAYS = 7;
export const SNAPSHOT_QUERY_LIMIT = 50;

function snapshotsCollection(uid: string) {
  return collection(getFirebaseDb(), "users", uid, "snapshots");
}

export async function saveScenarioSnapshot({
  uid,
  scenario,
  snapshot,
}: SaveSnapshotInput): Promise<string> {
  const whitebit = snapshot?.tickers.find((t) => t.exchange === "whitebit");
  const docRef = await addDoc(snapshotsCollection(uid), {
    scenario,
    market_summary: {
      whitebit_price: whitebit?.last_price ?? null,
      divergence_pct: snapshot?.divergence_pct ?? {},
      collected_at: snapshot?.collected_at ?? scenario.generated_at,
    },
    saved_at: serverTimestamp(),
  });
  return docRef.id;
}

export function subscribeRecentSnapshots(
  uid: string,
  onData: (records: SavedSnapshotRecord[]) => void,
  onError: (message: string) => void,
): () => void {
  const cutoff = Timestamp.fromDate(
    new Date(Date.now() - SNAPSHOT_RETENTION_DAYS * 24 * 60 * 60 * 1000),
  );
  const q = query(
    snapshotsCollection(uid),
    where("saved_at", ">=", cutoff),
    orderBy("saved_at", "desc"),
    limit(SNAPSHOT_QUERY_LIMIT),
  );
  return onSnapshot(
    q,
    (snap) => {
      const records: SavedSnapshotRecord[] = snap.docs.map((doc) => {
        const data = doc.data();
        const ts = data.saved_at as FirestoreTimestamp | undefined;
        return {
          id: doc.id,
          scenario: data.scenario as ScenarioResponse,
          market_summary: data.market_summary,
          saved_at: ts?.toDate() ?? null,
        };
      });
      onData(records);
    },
    (err) => onError(err.message),
  );
}
