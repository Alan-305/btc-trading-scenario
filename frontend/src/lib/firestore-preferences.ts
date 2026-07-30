import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Timestamp as FirestoreTimestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "./firebase";

export interface NotificationPreferences {
  morningEmailEnabled: boolean;
  morningEmailUnsubscribeToken: string | null;
  updatedAt: Date | null;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  morningEmailEnabled: false,
  morningEmailUnsubscribeToken: null,
  updatedAt: null,
};

function preferencesDoc(uid: string) {
  return doc(getFirebaseDb(), "users", uid, "settings", "preferences");
}

function mapPreferences(data: Record<string, unknown> | undefined): NotificationPreferences {
  if (!data) return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  const updated = data.updatedAt as FirestoreTimestamp | undefined;
  return {
    morningEmailEnabled: Boolean(data.morningEmailEnabled),
    morningEmailUnsubscribeToken:
      typeof data.morningEmailUnsubscribeToken === "string" ? data.morningEmailUnsubscribeToken : null,
    updatedAt: updated?.toDate() ?? null,
  };
}

function generateUnsubscribeToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function subscribeNotificationPreferences(
  uid: string,
  onData: (prefs: NotificationPreferences) => void,
  onError?: (message: string) => void,
): () => void {
  return onSnapshot(
    preferencesDoc(uid),
    (snapshot) => {
      onData(mapPreferences(snapshot.data()));
    },
    (error) => {
      onError?.(error.message);
    },
  );
}

export async function setMorningEmailEnabled(uid: string, enabled: boolean): Promise<void> {
  const ref = preferencesDoc(uid);
  const patch: Record<string, unknown> = {
    morningEmailEnabled: enabled,
    updatedAt: serverTimestamp(),
  };
  if (enabled) {
    patch.morningEmailUnsubscribeToken = generateUnsubscribeToken();
  }
  await setDoc(ref, patch, { merge: true });
}
