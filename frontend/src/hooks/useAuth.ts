import type { User } from "firebase/auth";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import { consumeRedirectResult } from "../lib/auth-redirect";
import { isLocalDevHost } from "../lib/auth-strategy";
import { getFirebaseAuth } from "../lib/firebase";
import { isEmailInvited, requiresAuthentication } from "../lib/invite-access";

export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string }).code;
  if (code === "auth/popup-closed-by-user") {
    return "ログインがキャンセルされました。";
  }
  if (code === "auth/popup-blocked") {
    return "ポップアップがブロックされました。Chrome のアドレスバー右の許可アイコンからポップアップを許可してください。";
  }
  if (code === "auth/unauthorized-domain") {
    return "このドメインは Firebase で許可されていません。管理者にお問い合わせください。";
  }
  if (code === "auth/account-exists-with-different-credential") {
    return "別の方法で登録されたアカウントです。Google アカウントを確認してください。";
  }
  if (code === "auth/operation-not-allowed") {
    return "Google ログインが有効になっていません。管理者にお問い合わせください。";
  }
  if (code === "auth/too-many-requests") {
    return "試行回数が多すぎます。しばらく待ってから再試行してください。";
  }
  if (error instanceof Error) return error.message;
  return "ログインに失敗しました";
}

async function ensureInvited(user: User, authRequired: boolean): Promise<boolean> {
  if (!authRequired) return true;
  const email = user.email;
  if (!email) return false;
  return isEmailInvited(email);
}

export function useAuth(enabled: boolean) {
  const authRequired = enabled && requiresAuthentication();
  const inviteOnly = authRequired;
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isInvited, setIsInvited] = useState(!inviteOnly);
  const [inviteChecking, setInviteChecking] = useState(false);
  const localDev = isLocalDevHost();

  const rejectIfNotInvited = useCallback(
    async (next: User | null) => {
      if (!next) {
        setIsInvited(!inviteOnly);
        return true;
      }
      if (!inviteOnly) {
        setIsInvited(true);
        return true;
      }

      setInviteChecking(true);
      try {
        const invited = await ensureInvited(next, inviteOnly);
        if (!invited) {
          await signOut(getFirebaseAuth());
          setUser(null);
          setIsInvited(false);
          setAuthError("このアカウントは招待されていません。管理者にお問い合わせください。");
          return false;
        }
        setUser(next);
        setIsInvited(true);
        setAuthError(null);
        return true;
      } finally {
        setInviteChecking(false);
      }
    },
    [inviteOnly],
  );

  useEffect(() => {
    if (!enabled) {
      setUser(null);
      setLoading(false);
      setSigningIn(false);
      setIsInvited(true);
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
          void rejectIfNotInvited(next).finally(() => {
            if (!cancelled) {
              setLoading(false);
              setSigningIn(false);
            }
          });
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
  }, [enabled, localDev, rejectIfNotInvited]);

  const signInWithGoogle = useCallback(async () => {
    if (!enabled) return;
    setAuthError(null);
    setSigningIn(true);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      if (localDev) {
        const cred = await signInWithPopup(getFirebaseAuth(), provider);
        const ok = await rejectIfNotInvited(cred.user);
        if (!ok) setSigningIn(false);
        return;
      }

      // Production: redirect + same-origin auth handler (Chrome 115+ compatible)
      await signInWithRedirect(getFirebaseAuth(), provider);
    } catch (error) {
      setAuthError(authErrorMessage(error));
      setSigningIn(false);
    }
  }, [enabled, localDev, rejectIfNotInvited]);

  const logout = useCallback(async () => {
    if (!enabled) return;
    setAuthError(null);
    try {
      await signOut(getFirebaseAuth());
      setUser(null);
      setIsInvited(!inviteOnly);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "ログアウトに失敗しました");
    }
  }, [enabled, inviteOnly]);

  const canAccessApp = !authRequired || (Boolean(user) && isInvited && !inviteChecking);

  return {
    user,
    loading: loading || inviteChecking,
    signingIn,
    authError,
    localDev,
    inviteOnly,
    isInvited,
    canAccessApp,
    signInWithGoogle,
    logout,
  };
}
