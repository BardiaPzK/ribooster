// frontend/src/lib/auth.ts
export function setAuthSession(res: {
  token: string;
  is_admin: boolean;
  username: string;
  display_name?: string | null;
  org_id?: string | null;
  org_name?: string | null;
  company_code?: string | null;
}) {
  localStorage.setItem("token", res.token);
  localStorage.setItem("is_admin", String(res.is_admin));
  localStorage.setItem("username", res.username);
  if (res.display_name) localStorage.setItem("display_name", res.display_name);
  if (res.org_id) localStorage.setItem("org_id", res.org_id);
  if (res.org_name) localStorage.setItem("org_name", res.org_name);
  if (res.company_code) localStorage.setItem("company_code", res.company_code);
}

export function clearAuthSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("is_admin");
  localStorage.removeItem("username");
  localStorage.removeItem("display_name");
  localStorage.removeItem("org_id");
  localStorage.removeItem("org_name");
  localStorage.removeItem("company_code");
}

export function getToken(): string | null {
  return localStorage.getItem("token");
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

export function isAdmin(): boolean {
  return localStorage.getItem("is_admin") === "true";
}
