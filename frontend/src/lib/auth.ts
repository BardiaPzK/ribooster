export type Session = {
  token: string;
  is_admin: boolean;
  org_id: number | null;
  org_name: string | null;
  username: string;
  display_name: string;
};

const KEY = "ribooster.session";

export function saveSession(s: Session) {
  localStorage.setItem(KEY, JSON.stringify(s));
}
export function loadSession(): Session | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as Session; } catch { return null; }
}
export function clearSession() {
  localStorage.removeItem(KEY);
}
