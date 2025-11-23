// frontend/src/pages/admin/AdminOrgs.tsx
import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";

type OrgRow = {
  org: any;
  company: any;
  metrics: { total_requests: number; logins_success: number; logins_failed: number };
};

const featureList = ["projects.backup", "ai.helpdesk", "csv.import", "ai.query_studio"];

export const AdminOrgs: React.FC = () => {
  const [rows, setRows] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.adminListOrgs();
      setRows(data);
    } catch (e: any) {
      setError(e?.message || "Failed to load organizations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onCreate: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      name: fd.get("name") as string,
      access_code: fd.get("access_code") as string,
      base_url: fd.get("base_url") as string,
      rib_company_code: fd.get("rib_company_code") as string,
      contact_email: fd.get("contact_email") || undefined,
      contact_phone: fd.get("contact_phone") || undefined,
      notes: fd.get("notes") || undefined,
      plan: (fd.get("plan") as string) || "monthly",
      allowed_users: ((fd.get("allowed_users") as string) || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    };
    await api.adminCreateOrg(body);
    (e.target as HTMLFormElement).reset();
    await load();
  };

  const toggleFeature = async (row: OrgRow, feature: string) => {
    const has = (row.org.features || []).includes(feature);
    const next = has
      ? (row.org.features || []).filter((f: string) => f !== feature)
      : [...(row.org.features || []), feature];
    await api.adminUpdateOrg(row.org.org_id, { features: next });
    await load();
  };

  const toggleActive = async (row: OrgRow) => {
    await api.adminUpdateOrg(row.org.org_id, {
      active: !row.org.license.active
    });
    await load();
  };

  return (
    <div className="space-y-6">
      <section className="card p-6 space-y-4">
        <h1 className="text-2xl font-semibold mb-2">Organizations</h1>
        <p className="text-sm text-slate-400">
          Create, update and monitor organizations, company URLs, permitted users, license
          state and services (for now visual only).
        </p>
        <form onSubmit={onCreate} className="grid md:grid-cols-3 gap-3 mt-4">
          <input
            name="name"
            className="rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
            placeholder="Organization name"
            required
          />
          <input
            name="access_code"
            className="rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
            placeholder="Company Code (login)"
            required
          />
          <select
            name="plan"
            className="rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
          >
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
          <input
            name="base_url"
            className="rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm md:col-span-2"
            placeholder="RIB base URL (services)"
            required
          />
          <input
            name="rib_company_code"
            className="rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
            placeholder="RIB company code (e.g. 1000)"
            required
          />
          <input
            name="contact_email"
            className="rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
            placeholder="Contact email"
          />
          <input
            name="contact_phone"
            className="rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
            placeholder="Contact phone"
          />
          <input
            name="notes"
            className="rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm md:col-span-2"
            placeholder="Internal notes"
          />
          <input
            name="allowed_users"
            className="rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm md:col-span-3"
            placeholder="Permitted RIB usernames (comma separated)"
          />
          <div className="md:col-span-3 flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-medium"
            >
              Create organization
            </button>
          </div>
        </form>
      </section>

      <section className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Existing organizations</h2>
          <button
            onClick={load}
            className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm"
          >
            Refresh
          </button>
        </div>
        {loading && <div className="text-sm text-slate-400 mb-2">Loading…</div>}
        {error && <div className="text-sm text-red-400 mb-2">{error}</div>}
        <div className="space-y-4">
          {rows.map((row) => (
            <div
              key={row.org.org_id}
              className="border border-slate-700/80 rounded-2xl p-4 space-y-3 bg-slate-950/40"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <div className="font-semibold">{row.org.name}</div>
                  <div className="text-xs text-slate-400">
                    Org ID: {row.org.org_id} · Company Code:{" "}
                    <span className="font-mono">{row.company.code}</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {row.company.base_url} · RIB company {row.company.rib_company_code}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Contact: {row.org.contact_email || "-"} ·{" "}
                    {row.org.contact_phone || "-"}
                  </div>
                </div>
                <div className="flex gap-6 items-center">
                  <div>
                    <div className="text-xs uppercase text-slate-400">Plan</div>
                    <div className="text-sm font-medium">{row.org.license.plan}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-slate-400">License</div>
                    <button
                      onClick={() => toggleActive(row)}
                      className={`px-3 py-1 rounded-xl text-xs font-medium ${
                        row.org.license.active
                          ? "bg-emerald-600/80"
                          : "bg-rose-700/80"
                      }`}
                    >
                      {row.org.license.active ? "Active" : "Inactive"}
                    </button>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-slate-400">Requests</div>
                    <div className="text-sm font-medium">
                      {row.metrics.total_requests ?? 0}
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-slate-400 mb-1">Features</div>
                <div className="flex flex-wrap gap-2">
                  {featureList.map((f) => {
                    const enabled = (row.org.features || []).includes(f);
                    return (
                      <button
                        key={f}
                        onClick={() => toggleFeature(row, f)}
                        className={`px-3 py-1 rounded-full text-xs border ${
                          enabled
                            ? "bg-indigo-600 text-white border-indigo-500"
                            : "bg-slate-900 border-slate-700"
                        }`}
                      >
                        {enabled ? "On" : "Off"} · {f}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-slate-400 mb-1">
                  Permitted users
                </div>
                <div className="text-xs text-slate-300">
                  {(row.company.allowed_users || []).length
                    ? row.company.allowed_users.join(", ")
                    : "No explicit restrictions (all RIB users allowed)."}
                </div>
              </div>
            </div>
          ))}
          {!rows.length && !loading && (
            <div className="text-sm text-slate-400">No organizations yet.</div>
          )}
        </div>
      </section>
    </div>
  );
};
