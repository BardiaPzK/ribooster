// frontend/src/pages/admin/AdminOverview.tsx
import React, { useEffect, useState } from "react";
import { api, MetricsOverviewItem } from "../../lib/api";
import StatCard from "../../components/StatCard";

const AdminOverview: React.FC = () => {
  const [items, setItems] = useState<MetricsOverviewItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.admin
      .metricsOverview()
      .then((data) => setItems(data))
      .catch((e: any) => setError(e?.message || "Failed to load metrics"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-sm text-slate-400">Loading metrics…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="text-lg font-semibold text-slate-100">Overview</div>
      {error && <div className="text-sm text-red-400">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          label="Total orgs"
          value={items.length}
          sub="Number of customer organizations"
        />
        <StatCard
          label="Total requests"
          value={items.reduce((sum, i) => sum + i.total_requests, 0)}
        />
        <StatCard
          label="RIB API calls"
          value={items.reduce((sum, i) => sum + i.total_rib_calls, 0)}
        />
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm">
        <div className="font-medium mb-2">Per organization</div>
        <div className="overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-1 pr-2">Org</th>
                <th className="py-1 pr-2 text-right">Requests</th>
                <th className="py-1 pr-2 text-right">RIB calls</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.org_id} className="border-b border-slate-900/60">
                  <td className="py-1 pr-2">{i.org_name}</td>
                  <td className="py-1 pr-2 text-right">{i.total_requests}</td>
                  <td className="py-1 pr-2 text-right">{i.total_rib_calls}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-2 text-slate-500">
                    No data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminOverview;
