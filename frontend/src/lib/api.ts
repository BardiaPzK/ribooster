// frontend/src/lib/api.ts
import { getAuthToken } from "./auth";

const API_BASE = "/api";

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
        // ignore
      }
    }
    throw new Error(msg);
  }

  if (res.status === 204) {
    return undefined as unknown as T;
  }

  return (await res.json()) as T;
}

// ───────────────────────── Types ─────────────────────────

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
  plan: "monthly" | "yearly";
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
  ai_api_key?: string | null;
}

export interface MetricCounters {
  total_requests: number;
  total_rib_calls: number;
  per_feature: Record<string, number>;
}

export interface OrgListItem {
  org: Organization;
  company: Company;
  metrics?: MetricCounters | null;
}

export interface MetricsOverviewItem {
  org_id: string;
  org_name: string;
  total_requests: number;
  total_rib_calls: number;
  by_feature: Record<string, number>;
}

export interface Ticket {
  ticket_id: string;
  org_id: string;
  company_id: string;
  user_id: string;
  subject: string;
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "in_progress" | "done";
  created_at: number;
  updated_at: number;
  messages: { message_id: string; timestamp: number; sender: string; text: string }[];
}

export interface TicketListItem {
  ticket_id: string;
  subject: string;
  priority: string;
  status: string;
  created_at: number;
  updated_at: number;
}

export interface HelpdeskMessage {
  message_id: string;
  timestamp: number;
  sender: "user" | "ai";
  text: string;
}

export interface HelpdeskConversation {
  conversation_id: string;
  org_id: string;
  company_id: string;
  user_id: string;
  created_at: number;
  updated_at: number;
  messages: HelpdeskMessage[];
}

export interface ProjectOut {
  id: string;
  name: string;
}

export interface ProjectBackupJob {
  job_id: string;
  org_id: string;
  company_id: string;
  user_id: string;
  project_id: string;
  project_name: string;
  status: "pending" | "running" | "completed" | "failed";
  created_at: number;
  updated_at: number;
  log: string[];
  options: Record<string, unknown>;
}

export interface UserContext {
  org: Organization;
  company: Company;
}

// ───────────────────────── API ─────────────────────────

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

  // Admin
  admin: {
    metricsOverview() {
      return request<MetricsOverviewItem[]>("/admin/metrics/overview");
    },
    listOrgs() {
      return request<OrgListItem[]>("/admin/orgs");
    },
    createOrg(payload: {
      name: string;
      contact_email?: string;
      contact_phone?: string;
      notes?: string;
      plan: "monthly" | "yearly";
      current_period_end: number;
      base_url: string;
      rib_company_code: string;
      company_code: string;
      allowed_users: string[];
    }) {
      return request<OrgListItem>("/admin/orgs", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    updateOrg(org_id: string, payload: Partial<Organization> & { features?: Record<string, boolean> }) {
      return request<Organization>(`/admin/orgs/${org_id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    },
    updateCompany(company_id: string, payload: Partial<Company>) {
      return request<Company>(`/admin/companies/${company_id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    },
    listTickets() {
      return request<Ticket[]>("/admin/tickets");
    },
    replyTicket(ticket_id: string, payload: { text?: string; status?: string; priority?: string }) {
      return request<Ticket>(`/admin/tickets/${ticket_id}/reply`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
  },

  // User tickets
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
    getTicket(ticket_id: string) {
      return request<Ticket>(`/user/tickets/${ticket_id}`);
    },
    replyTicket(ticket_id: string, text: string) {
      return request<Ticket>(`/user/tickets/${ticket_id}/reply`, {
        method: "POST",
        body: JSON.stringify({ text }),
      });
    },
  },

  // Helpdesk
  helpdesk: {
    listConversations() {
      return request<HelpdeskConversation[]>("/user/helpdesk/conversations");
    },
    chat(conversation_id: string | null, text: string) {
      return request<HelpdeskConversation>("/user/helpdesk/chat", {
        method: "POST",
        body: JSON.stringify({ conversation_id, text }),
      });
    },
  },

  // Projects & backup
  projects: {
    list() {
      return request<ProjectOut[]>("/user/projects");
    },
    startBackup(payload: {
      project_id: string;
      project_name: string;
      include_estimates: boolean;
      include_lineitems: boolean;
      include_resources: boolean;
      include_activities: boolean;
    }) {
      return request<ProjectBackupJob>("/user/projects/backup", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    getBackup(job_id: string) {
      return request<ProjectBackupJob>(`/user/projects/backup/${job_id}`);
    },
  },
};
