import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb, isFirebaseConfigured } from "./firebase";

export function isInviteOnlyEnabled(): boolean {
  return import.meta.env.VITE_INVITE_ONLY === "true";
}

/** Firebase 設定済みの本番では常にログイン必須 */
export function requiresAuthentication(): boolean {
  if (!isFirebaseConfigured()) return isInviteOnlyEnabled();
  return import.meta.env.PROD || isInviteOnlyEnabled();
}

function allowedEmailsFromEnv(): Set<string> {
  const raw = import.meta.env.VITE_ALLOWED_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isEmailAllowedByEnv(email: string): boolean {
  const allowed = allowedEmailsFromEnv();
  if (allowed.size === 0) return false;
  return allowed.has(email.trim().toLowerCase());
}

export async function isEmailInvited(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  if (isEmailAllowedByEnv(normalized)) return true;

  const snap = await getDoc(doc(getFirebaseDb(), "invites", normalized));
  return snap.exists();
}
