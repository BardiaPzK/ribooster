// frontend/src/lib/auth.ts
// Central auth store + helper functions + React hook

export type AuthSession = {
  token: string;
  is_admin: boolean;
  username: string;
  display_name: string;
  org_id?: string | null;
  org_name?: string | null;
  company_id?: string | null;
  company_code?: string | null;
  rib_role?: string | null;
  rib_exp_ts?: number | null;
};

const STORAGE_KEY = "ribooster.session";

/**
 * Save session to localStorage.
 */
export function setSession(sess: AuthSession | null): void {
  if (!sess) {
    localStorage.removeItem(STORAGE_KEY);
    emitAuthChange(null);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sess));
  emitAuthChange(sess);
}

/**
 * Read session from localStorage.
 */
export function getSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

/**
 * Simple helpers for non-React code.
 */
export function isLoggedIn(): boolean {
  return !!getSession();
}

export function isAdmin(): boolean {
  const s = getSession();
  return !!s?.is_admin;
}

export function getToken(): string | null {
  return getSession()?.token ?? null;
}

/**
 * Low-level login call against /api/auth/login.
 * Stores the session automatically and returns it.
 */
export async function login(
  companyCode: string,
  username: string,
  password: string
): Promise<AuthSession> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      company_code: companyCode,
      username,
      password,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body?.detail || `Login failed (${res.status})`;
    throw new Error(msg);
  }

  const data = await res.json();

  const sess: AuthSession = {
    token: data.token,
    is_admin: data.is_admin,
    username: data.username,
    display_name: data.display_name,
    org_id: data.org_id ?? null,
    org_name: data.org_name ?? null,
    company_id: data.company_id ?? null,
    company_code: data.company_code ?? null,
    rib_role: data.rib_role ?? null,
    rib_exp_ts: data.rib_exp_ts ?? null,
  };

  setSession(sess);
  return sess;
}

/**
 * Logout helper.
 */
export function logout(): void {
  setSession(null);
}

// ───────────────────────── React hook ─────────────────────────

type AuthListener = (sess: AuthSession | null) => void;

const listeners = new Set<AuthListener>();

function emitAuthChange(sess: AuthSession | null) {
  for (const l of listeners) {
    try {
      l(sess);
    } catch {
      // ignore
    }
  }
}

function subscribe(listener: AuthListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * useAuth hook: React-friendly auth state.
 */
import { useEffect, useState } from "react";

export function useAuth() {
  const [session, setSessionState] = useState<AuthSession | null>(() => {
    if (typeof window === "undefined") return null;
    return getSession();
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const unsub = subscribe((sess) => setSessionState(sess));
    // Sync once on mount
    setSessionState(getSession());
    return unsub;
  }, []);

  return {
    user: session,
    token: session?.token ?? null,
    loading: false,
  };
}

// Default export for `import useAuth from "./lib/auth";`
export default useAuth;
