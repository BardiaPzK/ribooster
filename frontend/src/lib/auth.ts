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

/*
 * Save session
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

/*
 * Load session
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

/*
 * Helper functions
 */
export function isLoggedIn() {
  return !!getSession();
}

export function isAdmin() {
  return !!getSession()?.is_admin;
}

/*
 * 🔥 IMPORTANT — required by api.ts
 */
export function getAuthToken(): string | null {
  return getSession()?.token ?? null;
}

/*
 * Login
 */
export async function login(companyCode: string, username: string, password: string) {
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

/*
 * Logout
 */
export function logout() {
  setSession(null);
}

/*
 * Auth listeners
 */
type AuthListener = (s: AuthSession | null) => void;
const listeners = new Set<AuthListener>();

function emitAuthChange(sess: AuthSession | null) {
  for (const l of listeners) {
    try { l(sess); } catch {}
  }
}

function subscribe(listener: AuthListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/*
 * React hook
 */
import { useState, useEffect } from "react";

export function useAuth() {
  const [session, setState] = useState<AuthSession | null>(() => {
    if (typeof window === "undefined") return null;
    return getSession();
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const unsub = subscribe((sess) => setState(sess));
    setState(getSession());
    return unsub;
  }, []);

  return {
    user: session,
    token: session?.token ?? null,
    loading: false,
  };
}

// Default export to allow `import useAuth from "..."`
export default useAuth;
