// frontend/src/pages/UserDashboard.tsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import { api, UserContext, TicketListItem } from "../lib/api";
import useAuth from "../lib/auth";

export default function UserDashboard() {
  const [ctx, setCtx] = useState<UserContext | null>(null);
  const [ticketStats, setTicketStats] = useState({ total: 0, open: 0 });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

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

  const firstName =
    user?.display_name?.split(" ")[0] || user?.username || ctx?.company?.name?.split(" ")[0] || "there";

  const features = ctx?.company?.features || {};
  const licenseActive = ctx?.org?.license?.active !== false;
  const cards = [
    {
      key: "tickets",
      to: "/user/tickets",
      icon: "🎫",
      title: "Support Tickets",
      description: `${ticketStats.open} open · ${ticketStats.total} total`,
      active: true,
    },
    {
      key: "projects.backup",
      to: "/user/backup",
      icon: "🗂️",
      title: "Project Backup",
      description: "Load RIB projects and run backups",
      active: features["projects.backup"] !== false,
    },
    {
      key: "ai.helpdesk",
      to: "/user/helpdesk",
      icon: "🤖",
      title: "RIB Helpdesk AI",
      description: "Chat with the helpdesk assistant",
      active: features["ai.helpdesk"] !== false,
    },
    {
      key: "textsql",
      to: "/user/text-sql",
      icon: "🧠",
      title: "Text to SQL",
      description: "Generate SQL and run queries",
      active: features["textsql"] !== false,
    },
  ];

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50">{`Welcome, ${firstName} 👋`}</h1>
          {ctx && (
            <p className="text-sm text-slate-400 mt-1">
              Organization: {ctx.org.name} · Company Code: {ctx.company.code}
            </p>
          )}
        </div>

        {loading && (
          <div className="text-sm text-slate-400">Loading overview…</div>
        )}

        {!loading && (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => {
              const featureActive = card.active !== false;
              const allowed = card.key === "tickets" ? true : featureActive && licenseActive;
              const note =
                card.key === "tickets"
                  ? null
                  : !featureActive
                  ? "This service is an add-on. Please contact support."
                  : !licenseActive
                  ? "Company code license is inactive. Please contact support."
                  : null;

              return (
                <Link
                  key={card.key}
                  to={card.to}
                  onClick={(e) => {
                    if (!allowed) e.preventDefault();
                  }}
                  className={`rounded-2xl border p-4 transition-all flex flex-col ${
                    allowed
                      ? "border-slate-800 bg-slate-900/80 hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-950/40"
                      : "border-slate-900 bg-slate-950/60 opacity-70 cursor-not-allowed"
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-400">
                    <span className="text-lg">{card.icon}</span>
                    <span>{card.title}</span>
                  </div>
                  <div className="mt-3 text-sm font-semibold text-slate-50">{card.description}</div>
                  {note && <div className="mt-2 text-[11px] text-amber-400">{note}</div>}
                  <div className="mt-auto pt-3 text-xs text-indigo-400">Open →</div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
