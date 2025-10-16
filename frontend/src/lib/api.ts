import { loadSession } from "./auth";

const base = "/api"; // always call /api; NGINX proxies to backend root

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const s = loadSession();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(s?.token ? { Authorization: `Bearer ${s.token}` } : {}),
    ...(init.headers as Record<string, string> || {}),
  };
  const res = await fetch(`${base}${path}`, { ...init, headers });
  if (res.status === 401) {
    // bubble up for UI to redirect to login
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(msg || `HTTP ${res.status}`);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? (await res.json()) : ((await res.text()) as unknown as T);
}

export const api = {
  // health
  health: () => request<{ok: boolean; env: string}>("/health"),

  // auth
  login: (payload: {access_code: string; username: string; password: string}) =>
    request<{
      token: string; is_admin: boolean; org_id: number|null; org_name: string|null;
      username: string; display_name: string
    }>("/auth/login", { method: "POST", body: JSON.stringify(payload) }),

  // admin
  adminListOrgs: () => request<any[]>("/admin/orgs"),
  adminCreateOrg: (payload: {name: string; base_url: string; company_code: string; contact_email?: string; contact_phone?: string; notes?: string}) =>
    request("/admin/orgs", { method: "POST", body: JSON.stringify(payload) }),
  adminToggleFeatures: (org_id: number, features: string[], enabled: boolean) =>
    request(`/admin/orgs/${org_id}/features`, { method: "POST", body: JSON.stringify({ features, enabled }) }),
  adminDeactivateOrg: (org_id: number) => request(`/admin/orgs/${org_id}/deactivate`, { method: "POST" }),
  adminActivateAccess: (org_id: number) => request(`/admin/orgs/${org_id}/activate_access`, { method: "POST" }),
  adminPurchase: (org_id: number, plan: string) =>
    request("/billing/purchase", { method: "POST", body: JSON.stringify({ org_id, plan, provider: "placeholder" }) }),
  adminPayments: (org_id: number) => request(`/admin/orgs/${org_id}/payments`),
  adminGetSettings: (org_id: number) => request(`/admin/orgs/${org_id}/settings`),
  adminSetOpenAIKey: (org_id: number, key: string) =>
    request(`/admin/orgs/${org_id}/settings`, { method: "POST", body: JSON.stringify({ openai_api_key: key }) }),
  adminUploadSchema: async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const s = loadSession();
    const res = await fetch(`${base}/admin/schema`, {
      method: "POST",
      headers: s?.token ? { Authorization: `Bearer ${s.token}` } : undefined,
      body: fd,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // user tickets
  listTickets: () => request<any[]>("/tickets"),
  createTicket: (payload: {subject: string; priority?: string; body: string}) =>
    request("/tickets", { method: "POST", body: JSON.stringify(payload) }),
  replyTicket: (ticketId: number, body: string) =>
    request(`/tickets/${ticketId}/reply`, { method: "POST", body: JSON.stringify({ body }) }),
};
