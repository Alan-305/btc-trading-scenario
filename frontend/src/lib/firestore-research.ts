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
  updateDoc,
  writeBatch,
  type Timestamp as FirestoreTimestamp,
} from "firebase/firestore";
import type { ResearchItem, ResearchItemInput } from "../types/research";
import { getFirebaseDb } from "./firebase";

export const RESEARCH_QUERY_LIMIT = 300;

function researchCollection(uid: string) {
  return collection(getFirebaseDb(), "users", uid, "research");
}

function mapDoc(id: string, data: Record<string, unknown>): ResearchItem {
  const created = data.createdAt as FirestoreTimestamp | undefined;
  const updated = data.updatedAt as FirestoreTimestamp | undefined;
  return {
    id,
    title: (data.title as string) ?? "",
    sourceType: (data.sourceType as ResearchItem["sourceType"]) ?? "text",
    sourceUrl: (data.sourceUrl as string | null) ?? null,
    contentExcerpt: (data.contentExcerpt as string) ?? "",
    summaryLine: (data.summaryLine as string) ?? "",
    tags: (data.tags as string[]) ?? [],
    includeInAnalysis: Boolean(data.includeInAnalysis),
    status: (data.status as ResearchItem["status"]) ?? "active",
    marketContext: (data.marketContext as string | null) ?? null,
    createdAt: created?.toDate() ?? null,
    updatedAt: updated?.toDate() ?? null,
  };
}

export async function createResearchItem(uid: string, input: ResearchItemInput): Promise<string> {
  const docRef = await addDoc(researchCollection(uid), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateResearchItem(
  uid: string,
  itemId: string,
  input: ResearchItemInput,
): Promise<void> {
  await updateDoc(doc(researchCollection(uid), itemId), {
    ...input,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteResearchItem(uid: string, itemId: string): Promise<void> {
  await deleteDoc(doc(researchCollection(uid), itemId));
}

export async function bulkUpdateResearchItems(
  uid: string,
  ids: string[],
  patch: Partial<ResearchItemInput>,
): Promise<void> {
  if (ids.length === 0) return;
  const db = getFirebaseDb();
  const batch = writeBatch(db);
  for (const id of ids) {
    batch.update(doc(researchCollection(uid), id), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

export async function bulkDeleteResearchItems(uid: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = getFirebaseDb();
  const batch = writeBatch(db);
  for (const id of ids) {
    batch.delete(doc(researchCollection(uid), id));
  }
  await batch.commit();
}

export function subscribeResearchItems(
  uid: string,
  onData: (records: ResearchItem[]) => void,
  onError: (message: string) => void,
): () => void {
  const q = query(
    researchCollection(uid),
    orderBy("createdAt", "desc"),
    limit(RESEARCH_QUERY_LIMIT),
  );

  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => mapDoc(d.id, d.data())));
    },
    (err) => onError(err.message),
  );
}
