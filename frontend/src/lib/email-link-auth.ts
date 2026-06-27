import type { UserCredential } from "firebase/auth";
import { isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { getFirebaseAuth } from "./firebase";

function emailFromSignInUrl(href: string): string | null {
  try {
    return new URL(href).searchParams.get("email")?.trim().toLowerCase() ?? null;
  } catch {
    return null;
  }
}

/** Firebase メールリンク（招待）からのログインを完了する */
export async function completeEmailLinkSignInIfPresent(): Promise<UserCredential | null> {
  const auth = getFirebaseAuth();
  const href = window.location.href;
  if (!isSignInWithEmailLink(auth, href)) return null;

  const email =
    emailFromSignInUrl(href) ?? window.localStorage.getItem("emailForSignIn")?.trim().toLowerCase();
  if (!email) {
    throw new Error("メールアドレスが見つかりません。招待メールのリンクから再度お試しください。");
  }

  const cred = await signInWithEmailLink(auth, email, href);
  window.localStorage.removeItem("emailForSignIn");
  window.history.replaceState({}, document.title, window.location.pathname);
  return cred;
}

export function isEmailLinkSignInUrl(): boolean {
  return isSignInWithEmailLink(getFirebaseAuth(), window.location.href);
}
