// frontend/src/lib/auth.ts
const STORAGE_KEY = "ribooster_session";

export interface StoredSession {
  token: string;
  is_admin: boolean;
  username: string;
  display_name: string;
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
}
