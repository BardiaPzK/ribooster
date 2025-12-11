// frontend/src/lib/api.ts
import { getAuthToken } from "./auth";

const API_BASE = "/api";

// Generic request helper with auth header
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data && data.detail) msg = data.detail;
    } catch {
      try {
        msg = await res.text();
      } catch {
        /* ignore */
      }
    }
    throw new Error(msg);
  }

  if (res.status === 204) {
    return undefined as unknown as T;
  }

  return (await res.json()) as T;
}

// ---- API Types & Endpoints ----

export interface LoginResponse {
  token: string;
  is_admin: boolean;
  username: string;
  display_name: string;
  org_id?: string | null;
  org_name?: string | null;
  company_id?: string | null;
  company_code?: string | null;
  rib_exp_ts?: number | null;
  rib_role?: string | null;
}

export interface MeResponse {
  token: string;
  user_id: string;
  username: string;
  display_name: string;
  is_admin: boolean;
  org_id?: string | null;
  company_id?: string | null;
}

export interface License {
  plan: "trial" | "monthly" | "yearly";
  active: boolean;
  current_period_end: number;
}

export interface Organization {
  org_id: string;
  name: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  notes?: string | null;
  license: License;
  features: Record<string, boolean>;
}

export interface Company {
  company_id: string;
  org_id: string;
  name: string;
  code: string;
  base_url: string;
  rib_company_code: string;
  allowed_users: string[];
  license?: License | null;
  ai_api_key?: string | null;
  features: Record<string, boolean>;
}

export interface MetricCounters {
  total_requests: number;
  total_rib_calls: number;
  per_feature: Record<string, number>;
}

export interface OrgListItem {
  org: Organization;
  company?: Company;
  companies: Company[];
  metrics?: MetricCounters | null;
}

export interface TicketListItem {
  ticket_id: string;
  subject: string;
  priority: string;
  status: string;
  created_at: number;
  updated_at: number;
}

export interface Ticket {
  ticket_id: string;
  org_id: string;
  company_id: string;
  user_id: string;
  org_name?: string | null;
  company_code?: string | null;
  username?: string | null;
  subject: string;
  priority: string;
  status: string;
  created_at: number;
  updated_at: number;
  messages: { message_id: string; timestamp: number; sender: string; text: string }[];
}

export interface Payment {
  id: number;
  org_id: string;
  company_id?: string | null;
  created_at: number;
  currency: string;
  amount_cents: number;
  description?: string | null;
  period_start?: number | null;
  period_end?: number | null;
  external_id?: string | null;
}

export interface UserContext {
  org: Organization;
  company: Company;
}

export const api = {
  login(company_code: string, username: string, password: string) {
    return request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ company_code, username, password }),
    });
  },

  me() {
    return request<MeResponse>("/auth/me");
  },

  userContext() {
    return request<UserContext>("/user/context");
  },

  admin: {
    metricsOverview() {
      return request<MetricCounters[]>("/admin/metrics/overview");
    },
    listOrgs() {
      return request<OrgListItem[]>("/admin/orgs");
    },
    createOrg(payload: any) {
      return request<OrgListItem>("/admin/orgs", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    updateOrg(org_id: string, payload: any) {
      return request<Organization>(`/admin/orgs/${org_id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    },
    updateCompany(company_id: string, payload: any) {
      return request<Company>(`/admin/companies/${company_id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    },
    createCompany(org_id: string, payload: any) {
      return request<Company>(`/admin/orgs/${org_id}/companies`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    deleteCompany(company_id: string) {
      return request(`/admin/companies/${company_id}`, { method: "DELETE" });
    },
    deleteOrg(org_id: string) {
      return request(`/admin/orgs/${org_id}`, { method: "DELETE" });
    },
    deletePayment(payment_id: number) {
      return request(`/admin/payments/${payment_id}`, { method: "DELETE" });
    },
    listTickets() {
      return request<Ticket[]>("/admin/tickets");
    },
    replyTicket(ticket_id: string, payload: any) {
      return request<Ticket>(`/admin/tickets/${ticket_id}/reply`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    listPayments(company_id: string) {
      return request<Payment[]>(`/admin/companies/${company_id}/payments`);
    },
    addPayment(company_id: string, payload: { payment_date: number; amount_cents: number; description?: string }) {
      return request<Payment>(`/admin/companies/${company_id}/payments`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
  },

  user: {
    listTickets() {
      return request<TicketListItem[]>("/user/tickets");
    },
    createTicket(subject: string, priority: string, text: string) {
      return request<Ticket>("/user/tickets", {
        method: "POST",
        body: JSON.stringify({ subject, priority, text }),
      });
    },
    getTicket(id: string) {
      return request<Ticket>(`/user/tickets/${id}`);
    },
    replyTicket(id: string, text: string) {
      return request<Ticket>(`/user/tickets/${id}/reply`, {
        method: "POST",
        body: JSON.stringify({ text }),
      });
    },
    textsqlRun(payload: any) {
      return request(`/user/textsql/run`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    helpdesk: {
      listConversations() {
        return request<any[]>("/user/helpdesk/conversations");
      },
      chat(payload: { conversation_id?: string; text: string }) {
        return request<any>("/user/helpdesk/chat", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      },
    },
  },

  projects: {
    list() {
      return request<any[]>("/user/projects");
    },
    startBackup(payload: any) {
      return request("/user/projects/backup", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    stopBackup(id: string) {
      return request(`/user/projects/backup/${id}/stop`, { method: "POST" });
    },
    getBackup(id: string) {
      return request(`/user/projects/backup/${id}`);
    },
    async downloadBackup(id: string): Promise<Blob> {
      const token = getAuthToken();
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_BASE}/user/projects/backup/${id}/file`, { headers });
      if (!res.ok) {
        try {
          const data = await res.json();
          throw new Error(data?.detail || `HTTP ${res.status}`);
        } catch {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
      }
      return res.blob();
    },
  },
};
