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
  where,
  type Timestamp as FirestoreTimestamp,
} from "firebase/firestore";
import type { JournalEntry, JournalEntryInput } from "../types/journal";
import { getFirebaseDb } from "./firebase";

export const JOURNAL_RETENTION_DAYS = 90;
export const JOURNAL_QUERY_LIMIT = 100;

function journalCollection(uid: string) {
  return collection(getFirebaseDb(), "users", uid, "journal");
}

function mapDoc(id: string, data: Record<string, unknown>): JournalEntry {
  const created = data.createdAt as FirestoreTimestamp | undefined;
  const updated = data.updatedAt as FirestoreTimestamp | undefined;
  const num = (key: string): number | null => {
    const v = data[key];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };
  return {
    id,
    type: (data.type as JournalEntry["type"]) ?? "idea",
    side: (data.side as JournalEntry["side"]) ?? null,
    status: (data.status as JournalEntry["status"]) ?? null,
    snapshotId: (data.snapshotId as string | null) ?? null,
    parentEntryId: (data.parentEntryId as string | null) ?? null,
    title: (data.title as string) ?? "",
    note: (data.note as string) ?? "",
    links: (data.links as JournalEntry["links"]) ?? [],
    tags: (data.tags as string[]) ?? [],
    entryPrice: num("entryPrice"),
    exitPrice: num("exitPrice"),
    size: num("size"),
    plannedSl: num("plannedSl"),
    plannedTp: num("plannedTp"),
    templateId: (data.templateId as string | null) ?? null,
    reviewScore: num("reviewScore"),
    reviewLesson: (data.reviewLesson as string) ?? "",
    images: (data.images as JournalEntry["images"]) ?? [],
    createdAt: created?.toDate() ?? null,
    updatedAt: updated?.toDate() ?? null,
  };
}

export async function createJournalEntry(
  uid: string,
  input: JournalEntryInput,
): Promise<string> {
  const docRef = await addDoc(journalCollection(uid), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateJournalEntry(
  uid: string,
  entryId: string,
  input: JournalEntryInput,
): Promise<void> {
  await updateDoc(doc(journalCollection(uid), entryId), {
    ...input,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteJournalEntry(uid: string, entryId: string): Promise<void> {
  await deleteDoc(doc(journalCollection(uid), entryId));
}

export function subscribeJournalEntries(
  uid: string,
  onData: (records: JournalEntry[]) => void,
  onError: (message: string) => void,
): () => void {
  const cutoff = Timestamp.fromDate(
    new Date(Date.now() - JOURNAL_RETENTION_DAYS * 24 * 60 * 60 * 1000),
  );
  const q = query(
    journalCollection(uid),
    where("createdAt", ">=", cutoff),
    orderBy("createdAt", "desc"),
    limit(JOURNAL_QUERY_LIMIT),
  );

  return onSnapshot(
    q,
    (snap) => {
      const records = snap.docs.map((d) => mapDoc(d.id, d.data()));
      onData(records);
    },
    (err) => onError(err.message),
  );
}
