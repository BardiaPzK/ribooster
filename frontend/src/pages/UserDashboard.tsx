// frontend/src/pages/UserDashboard.tsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import { api, UserContext, TicketListItem } from "../lib/api";

export default function UserDashboard() {
  const [ctx, setCtx] = useState<UserContext | null>(null);
  const [ticketStats, setTicketStats] = useState({ total: 0, open: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const c = await api.userContext();
        setCtx(c);

        const tickets = await api.user.listTickets().catch(() => [] as TicketListItem[]);
        const total = tickets.length;
        const open = tickets.filter((t) => t.status !== "done").length;
        setTicketStats({ total, open });
      } catch (err) {
        console.error("Failed to load dashboard context", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const displayName = ctx
    ? (ctx.org.name || "").split(" ")[0] ||
      (ctx.company.name || "").split(" ")[0] ||
      ""
    : "";

  const firstName =
    (ctx && (ctx.org.name || ctx.company.name || "").split(" ")[0]) ||
    "";

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50">
            {ctx ? `Welcome, ${firstName || "there"} 👋` : "Welcome 👋"}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {ctx
              ? `Organization: ${ctx.org.name} · Company Code: ${ctx.company.code}`
              : "You are logged in with your RIB account."}
          </p>
        </div>

        {loading && (
          <div className="text-sm text-slate-400">Loading overview…</div>
        )}

        {!loading && (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            {/* Tickets */}
            <Link
              to="/user/tickets"
              className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-950/40 transition-all flex flex-col"
            >
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-400">
                <span className="text-lg">🎫</span>
                <span>Support Tickets</span>
              </div>
              <div className="mt-3 text-2xl font-bold text-slate-50">
                {ticketStats.total}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {ticketStats.open} open
              </div>
              <div className="mt-auto pt-3 text-xs text-indigo-400">
                View and manage tickets →
              </div>
            </Link>

            {/* Project Backup */}
            <Link
              to="/user/projects"
              className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-950/40 transition-all flex flex-col"
            >
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-400">
                <span className="text-lg">🗂️</span>
                <span>Project Backup</span>
              </div>
              <div className="mt-3 text-lg font-semibold text-slate-50">
                Backup RIB projects
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Load projects from your RIB server and store small JSON
                snapshots.
              </div>
              <div className="mt-auto pt-3 text-xs text-indigo-400">
                Open backup service →
              </div>
            </Link>

            {/* Text to SQL */}
            <Link
              to="/user/text-sql"
              className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-950/40 transition-all flex flex-col"
            >
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-400">
                <span className="text-lg">🧠</span>
                <span>Text to SQL</span>
              </div>
              <div className="mt-3 text-lg font-semibold text-slate-50">
                Query your database
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Turn natural language into SQL and run it against your DB.
              </div>
              <div className="mt-auto pt-3 text-xs text-indigo-400">
                Start querying →
              </div>
            </Link>
          </div>
        )}
      </div>
    </Layout>
  );
}
