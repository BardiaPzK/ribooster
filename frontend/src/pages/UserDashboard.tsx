// frontend/src/pages/UserDashboard.tsx
import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { api, MeResponse, TicketsSummaryResponse } from "../lib/api";
import StatCard from "../components/StatCard";

type DashboardData = {
  me: MeResponse | null;
  tickets: TicketsSummaryResponse | null;
};

const UserDashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData>({ me: null, tickets: null });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const [me, tickets] = await Promise.all([
          api.me().catch(() => null),
          api.userTicketsSummary().catch(() => null),
        ]);

        if (!cancelled) {
          setData({ me, tickets });
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load dashboard data");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const { me, tickets } = data;

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-medium text-slate-500">
              Welcome{me ? "," : ""}{" "}
            </div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {me?.display_name || "ribooster user"}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Your personal hub for RIB iTWO 4.0 automations.
            </p>
          </div>

          {me && (
            <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <div>
                <span className="font-medium">Org:</span> {me.org_name}{" "}
                <span className="text-slate-400">({me.org_id})</span>
              </div>
              <div>
                <span className="font-medium">Company:</span>{" "}
                {me.company_code || me.company_id}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 text-xs text-red-700 px-3 py-2">
            {error}
          </div>
        )}

        {/* Stats row */}
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            label="Active tickets"
            value={tickets?.open ?? 0}
            hint={
              tickets
                ? `${tickets.open} open, ${tickets.in_progress} in progress`
                : "No ticket data yet"
            }
          />
          <StatCard
            label="Resolved tickets"
            value={tickets?.resolved ?? 0}
            hint={tickets ? `${tickets.resolved} closed total` : ""}
          />
          <StatCard
            label="Total requests"
            value={tickets?.total ?? 0}
            hint="All tickets created so far"
          />
        </div>

        {/* Feature sections */}
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">
              Quick actions
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <a
                href="/app/user/projects"
                className="block rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition p-4"
              >
                <div className="text-sm font-semibold text-slate-900">
                  Project backup
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Export project metadata and estimates from RIB in one click.
                </p>
              </a>

              <a
                href="/app/user/tickets"
                className="block rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition p-4"
              >
                <div className="text-sm font-semibold text-slate-900">
                  Support tickets
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Create and track tickets for issues, requests, or feature
                  ideas.
                </p>
              </a>

              {me?.is_admin && (
                <a
                  href="/app/admin"
                  className="block rounded-2xl border border-amber-200 bg-amber-50 hover:bg-amber-100 transition p-4"
                >
                  <div className="text-sm font-semibold text-amber-900">
                    Admin overview
                  </div>
                  <p className="text-xs text-amber-900/80 mt-1">
                    Manage organizations, companies, and user access.
                  </p>
                </a>
              )}

              {/* Text-to-SQL entry point */}
              <a
                href="/app/user/text-sql"
                className="block rounded-2xl border border-indigo-100 bg-indigo-50/60 hover:bg-indigo-100/60 transition p-4"
              >
                <div className="text-sm font-semibold text-indigo-900">
                  Text to SQL (beta)
                </div>
                <p className="text-xs text-indigo-900/80 mt-1">
                  Describe what you want in plain English. We generate the SQL
                  for your iTWO database and execute it.
                </p>
                <p className="text-[11px] text-indigo-900/60 mt-2">
                  Uses read-only queries per user session. Connection details
                  are not stored.
                </p>
              </a>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">
              What&apos;s included today
            </h2>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600 space-y-2">
              <p>
                This early version of ribooster focuses on three workflows:
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  <span className="font-semibold">Project backups:</span> Call
                  the RIB Web API and store small JSON snapshots for audits or
                  handovers.
                </li>
                <li>
                  <span className="font-semibold">Tickets:</span> Lightweight
                  issue tracking per org/company with an AI helpdesk on top.
                </li>
                <li>
                  <span className="font-semibold">Text to SQL:</span> Convert
                  natural language questions into SQL for your iTWO database.
                </li>
              </ul>
              <p className="pt-1">
                Later versions can add CSV imports, certificate tracking, and
                more integrations depending on what you need most.
              </p>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
};

export default UserDashboard;
