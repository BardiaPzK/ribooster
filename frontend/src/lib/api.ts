// frontend/src/lib/api.ts
const origin =
  (import.meta.env.VITE_API_BASE as string | undefined) || window.location.origin;

const API_BASE = origin.replace(/\/+$/, "") + "/api";

async function request<T>(
  path: string,
  options: RequestInit = {},
  auth: boolean = false
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (auth) {
    const token = localStorage.getItem("token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(API_BASE + path, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {})
    }
  });

  if (!res.ok) {
    const txt = await res.text();
    let msg = txt || res.statusText;
    try {
      const j = JSON.parse(txt);
      msg = j.detail || j.error || msg;
    } catch {
      // ignore
    }
    throw new Error(msg || "Request failed");
  }
  if (res.status === 204) return {} as T;
  return (await res.json()) as T;
}

export const api = {
  login: (company_code: string, username: string, password: string) =>
    request<{
      token: string;
      is_admin: boolean;
      username: string;
      display_name?: string;
      org_id?: string;
      org_name?: string;
      company_code?: string;
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ company_code, username, password })
    }),

  me: () => request("/auth/me", {}, true),

  adminListOrgs: () =>
    request<
      {
        org: any;
        company: any;
        metrics: { total_requests: number; logins_success: number; logins_failed: number };
      }[]
    >("/admin/orgs", {}, true),

  adminCreateOrg: (body: any) =>
    request("/admin/orgs", { method: "POST", body: JSON.stringify(body) }, true),

  adminUpdateOrg: (orgId: string, body: any) =>
    request(`/admin/orgs/${orgId}`, { method: "PUT", body: JSON.stringify(body) }, true),

  adminMetricsOverview: () =>
    request<{
      total_orgs: number;
      active_orgs: number;
      total_requests: number;
      total_logins_success: number;
      total_logins_failed: number;
    }>("/admin/metrics/overview", {}, true)
};
