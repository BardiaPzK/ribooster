// frontend/src/lib/auth.ts
import { useEffect, useState } from "react";

const STORAGE_KEY = "ribooster_session";

export interface StoredSession {
  token: string;
  is_admin: boolean;
  username: string;
  display_name: string;
}

// Small helper so other tabs / components can react to auth changes
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
  const s = getStoredSession();
  return s?.token ?? null;
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

// ───────────────────────── useAuth hook (for App.tsx) ─────────────────────────

export interface AuthState {
  user: StoredSession | null;
  loading: boolean;
}

/**
 * Simple auth hook used by AppRoutes.
 * - Reads the session from localStorage
 * - Updates when login/logout happens (via custom event + storage events)
 */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(() => {
    // During SSR / build there is no window
    if (typeof window === "undefined") {
      return { user: null, loading: true };
    }
    return { user: getStoredSession(), loading: false };
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const sync = () => {
      setState({ user: getStoredSession(), loading: false });
    };

    const handleStorage = (ev: StorageEvent) => {
      if (!ev.key || ev.key === STORAGE_KEY) {
        sync();
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("ribooster-auth-changed", sync as EventListener);

    // Initial sync just in case
    sync();

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(
        "ribooster-auth-changed",
        sync as EventListener
      );
    };
  }, []);

  return state;
}
