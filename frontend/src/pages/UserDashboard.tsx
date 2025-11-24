// frontend/src/pages/UserDashboard.tsx
import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";

type UserContext = {
  username: string;
  display_name: string;
  org_name?: string | null;
  company_code?: string | null;
  features?: Record<string, boolean>;
};

type TicketListItem = {
  ticket_id: string;
  subject: string;
  status: string;
  priority: string;
  updated_at: number;
};

const UserDashboard: React.FC = () => {
  const [ctx, setCtx] = useState<UserContext | null>(null);
  const [ticketStats, setTicketStats] = useState<{
    total: number;
    open: number;
  }>({ total: 0, open: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [ctxRes, ticketsRes] = await Promise.all([
          fetch("/api/user/context"),
          fetch("/api/user/tickets"),
        ]);

        if (ctxRes.ok) {
          const data = await ctxRes.json();
          setCtx(data);
        }

        if (ticketsRes.ok) {
          const items: TicketListItem[] = await ticketsRes.json();
          const total = items.length;
          const open = items.filter((t) => t.status !== "done").length;
          setTicketStats({ total, open });
        }
      } catch (err) {
        console.error("Failed to load dashboard context", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {ctx ? `Welcome, ${ctx.display_name || ctx.username}` : "Welcome"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {ctx?.org_name && ctx?.company_code
              ? `Organization: ${ctx.org_name} · Company Code: ${ctx.company_code}`
              : "You are logged in with your RIB account."}
          </p>
        </div>

        {loading && (
          <div className="text-sm text-slate-500">Loading overview…</div>
        )}

        {!loading && (
          <>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
              {/* Card: Tickets */}
              <a
                href="/app/tickets"
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="text-xs font-semibold uppercase text-slate-500">
                  Support Tickets
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {ticketStats.total}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {ticketStats.open} open
                </div>
                <div className="mt-3 text-xs text-blue-600">
                  View and manage tickets →
                </div>
              </a>

              {/* Card: Project Backup */}
              <a
                href="/app/projects/backup"
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="text-xs font-semibold uppercase text-slate-500">
                  Project Backup
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-900">
                  Backup RIB projects
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Create on-demand backups (projects, estimates, activities…)
                </div>
                <div className="mt-3 text-xs text-blue-600">
                  Open backup service →
                </div>
              </a>

              {/* Card: Text to SQL */}
              <a
                href="/app/text-to-sql"
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="text-xs font-semibold uppercase text-slate-500">
                  Text to SQL
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-900">
                  Query your database
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Turn natural language into SQL and run it against your DB.
                </div>
                <div className="mt-3 text-xs text-blue-600">
                  Start querying →
                </div>
              </a>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default UserDashboard;
