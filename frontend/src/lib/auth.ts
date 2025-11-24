// frontend/src/lib/auth.ts

import { useEffect, useState } from "react";

const STORAGE_KEY = "ribooster_session";

export interface StoredSession {
  token: string;
  is_admin: boolean;
  username: string;
  display_name: string;
}

function emitAuthChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("ribooster-auth-changed"));
  }
}

export function setAuthSession(res: {
  token: string;
  is_admin: boolean;
  username: string;
  display_name: string;
}) {
  const data: StoredSession = {
    token: res.token,
    is_admin: res.is_admin,
    username: res.username,
    display_name: res.display_name,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  emitAuthChange();
}

export function getStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export function getAuthToken(): string | null {
  return getStoredSession()?.token ?? null;
}

export function isLoggedIn(): boolean {
  return !!getAuthToken();
}

export function isAdmin(): boolean {
  const s = getStoredSession();
  return !!s?.is_admin;
}

export function clearAuthSession() {
  localStorage.removeItem(STORAGE_KEY);
  emitAuthChange();
}

export interface AuthState {
  user: StoredSession | null;
  loading: boolean;
}

/**
 * Hook that updates automatically when login/logout happens
 */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: typeof window === "undefined" ? null : getStoredSession(),
    loading: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const sync = () => {
      setState({ user: getStoredSession(), loading: false });
    };

    window.addEventListener("storage", sync);
    window.addEventListener("ribooster-auth-changed", sync as EventListener);
    sync();

    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(
        "ribooster-auth-changed",
        sync as EventListener
      );
    };
  }, []);

  return state;
}

// ⭐ DEFAULT EXPORT (fixes the Vite build error!)
export default useAuth;
