// frontend/src/pages/admin/AdminOverview.tsx
import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { StatCard } from "../../components/StatCard";

export const AdminOverview: React.FC = () => {
  const [stats, setStats] = useState<{
    total_orgs: number;
    active_orgs: number;
    total_requests: number;
    total_logins_success: number;
    total_logins_failed: number;
  } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.adminMetricsOverview();
        setStats(data);
      } catch {
        setStats(null);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <h1 className="text-2xl font-semibold mb-2">Overview</h1>
        <p className="text-sm text-slate-400">
          Simple request analytics across all organizations.
        </p>
      </section>
      <section className="grid md:grid-cols-3 gap-4">
        <StatCard label="Total orgs" value={stats?.total_orgs ?? 0} />
        <StatCard label="Active orgs" value={stats?.active_orgs ?? 0} />
        <StatCard label="Total requests" value={stats?.total_requests ?? 0} />
        <StatCard
          label="Successful logins"
          value={stats?.total_logins_success ?? 0}
        />
        <StatCard label="Failed logins" value={stats?.total_logins_failed ?? 0} />
      </section>
    </div>
  );
};
