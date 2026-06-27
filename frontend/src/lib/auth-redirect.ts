import type { Auth, UserCredential } from "firebase/auth";
import { getRedirectResult } from "firebase/auth";

let redirectResultPromise: Promise<UserCredential | null> | null = null;

/** getRedirectResult は 1 回だけ呼ぶ（React StrictMode 対策） */
export function consumeRedirectResult(auth: Auth): Promise<UserCredential | null> {
  if (!redirectResultPromise) {
    redirectResultPromise = getRedirectResult(auth).catch((error) => {
      redirectResultPromise = null;
      throw error;
    });
  }
  return redirectResultPromise;
}
