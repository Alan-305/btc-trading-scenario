import type { User } from "firebase/auth";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithRedirect,
  GoogleAuthProvider,
  signOut,
} from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import { consumeRedirectResult } from "../lib/auth-redirect";
import { isLocalDevHost } from "../lib/auth-strategy";
import { getFirebaseAuth } from "../lib/firebase";

export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string }).code;
  if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
    return "メールまたはパスワードが正しくありません。Firebase Console のユーザー設定を確認してください。";
  }
  if (code === "auth/user-not-found") {
    return "ユーザーが見つかりません。Firebase Console でユーザーを作成してください。";
  }
  if (code === "auth/invalid-email") {
    return "メールアドレスの形式が正しくありません。";
  }
  if (code === "auth/operation-not-allowed") {
    return "Firebase Console で「メール/パスワード」ログインを有効にしてください。";
  }
  if (code === "auth/too-many-requests") {
    return "試行回数が多すぎます。しばらく待ってから再試行してください。";
  }
  if (error instanceof Error) return error.message;
  return "ログインに失敗しました";
}

function getDevCredentials(): { email: string; password: string } | null {
  const email = import.meta.env.VITE_DEV_LOGIN_EMAIL?.trim();
  const password = import.meta.env.VITE_DEV_LOGIN_PASSWORD;
  if (!email || !password) return null;
  return { email, password };
}

export function useAuth(enabled: boolean) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const localDev = isLocalDevHost();

  useEffect(() => {
    if (!enabled) {
      setUser(null);
      setLoading(false);
      setSigningIn(false);
      return;
    }

    let cancelled = false;
    let unsub = () => {};
    setLoading(true);

    const boot = async () => {
      if (!localDev) {
        try {
          await consumeRedirectResult(getFirebaseAuth());
        } catch (error) {
          if (!cancelled) setAuthError(authErrorMessage(error));
        }
      }

      if (cancelled) return;

      unsub = onAuthStateChanged(
        getFirebaseAuth(),
        (next) => {
          if (cancelled) return;
          setUser(next);
          setLoading(false);
          setSigningIn(false);
          if (next) setAuthError(null);
        },
        (error) => {
          if (cancelled) return;
          setAuthError(authErrorMessage(error));
          setLoading(false);
          setSigningIn(false);
        },
      );
    };

    void boot();

    const timeout = window.setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 8000);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      unsub();
    };
  }, [enabled, localDev]);

  const signIn = useCallback(async () => {
    if (!enabled) return;
    setAuthError(null);
    setSigningIn(true);

    try {
      if (localDev) {
        const creds = getDevCredentials();
        if (!creds) {
          setAuthError(
            "frontend/.env.local に VITE_DEV_LOGIN_EMAIL と VITE_DEV_LOGIN_PASSWORD を設定してください。",
          );
          setSigningIn(false);
          return;
        }
        await signInWithEmailAndPassword(getFirebaseAuth(), creds.email, creds.password);
        setSigningIn(false);
        return;
      }

      await signInWithRedirect(getFirebaseAuth(), new GoogleAuthProvider());
    } catch (error) {
      setAuthError(authErrorMessage(error));
      setSigningIn(false);
    }
  }, [enabled, localDev]);

  const logout = useCallback(async () => {
    if (!enabled) return;
    setAuthError(null);
    try {
      await signOut(getFirebaseAuth());
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "ログアウトに失敗しました");
    }
  }, [enabled]);

  const devCredentialsReady = !localDev || getDevCredentials() !== null;

  return {
    user,
    loading,
    signingIn,
    authError,
    localDev,
    devCredentialsReady,
    signIn,
    logout,
  };
}
