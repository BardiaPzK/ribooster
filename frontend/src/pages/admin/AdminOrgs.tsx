// frontend/src/pages/admin/AdminOrgs.tsx
import React, { useEffect, useState } from "react";
import { api, OrgListItem } from "../../lib/api";

const AdminOrgs: React.FC = () => {
  const [orgs, setOrgs] = useState<OrgListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [ribCompanyCode, setRibCompanyCode] = useState("999");
  const [contactEmail, setContactEmail] = useState("");
  const [allowedUsersStr, setAllowedUsersStr] = useState("");

  const load = () => {
    setLoading(true);
    api.admin
      .listOrgs()
      .then((data) => setOrgs(data))
      .catch((e: any) => setError(e?.message || "Failed to load orgs"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const createOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        name: name.trim(),
        contact_email: contactEmail.trim() || undefined,
        contact_phone: undefined,
        notes: undefined,
        plan: "monthly" as const,
        current_period_end: now + 365 * 24 * 3600,
        base_url: baseUrl.trim(),
        rib_company_code: ribCompanyCode.trim(),
        company_code: companyCode.trim(),
        allowed_users: allowedUsersStr
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };
      await api.admin.createOrg(payload);
      setName("");
      setCompanyCode("");
      setBaseUrl("");
      setRibCompanyCode("999");
      setContactEmail("");
      setAllowedUsersStr("");
      load();
    } catch (e: any) {
      setError(e?.message || "Failed to create organization");
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-lg font-semibold text-slate-100">Organizations</div>
      {error && <div className="text-sm text-red-400">{error}</div>}

      <form
        onSubmit={createOrg}
        className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs"
      >
        <div className="space-y-1">
          <div className="font-medium text-slate-200">New organization</div>
          <input
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Org name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Contact email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <div className="font-medium text-slate-200">RIB connection</div>
          <input
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Company code (login)"
            value={companyCode}
            onChange={(e) => setCompanyCode(e.target.value)}
            required
          />
          <input
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="RIB base URL"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            required
          />
          <input
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="RIB company code (e.g. 999)"
            value={ribCompanyCode}
            onChange={(e) => setRibCompanyCode(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <div className="font-medium text-slate-200">Users</div>
          <textarea
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            rows={3}
            placeholder="Allowed usernames (comma separated). Leave empty = all users."
            value={allowedUsersStr}
            onChange={(e) => setAllowedUsersStr(e.target.value)}
          />
          <div className="flex justify-end">
            <button
              type="submit"
              className="mt-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs px-3 py-1.5"
            >
              Create org
            </button>
          </div>
        </div>
      </form>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-xs">
        <div className="font-medium mb-2 text-slate-200">Existing orgs</div>
        {loading ? (
          <div className="text-slate-500">Loading…</div>
        ) : orgs.length === 0 ? (
          <div className="text-slate-500">No organizations yet.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-left">
              <thead className="text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-1 pr-2">Org</th>
                  <th className="py-1 pr-2">Company code</th>
                  <th className="py-1 pr-2">RIB URL</th>
                  <th className="py-1 pr-2">Features</th>
                  <th className="py-1 pr-2">License</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((item) => (
                  <tr
                    key={item.org.org_id}
                    className="border-b border-slate-900/60 align-top"
                  >
                    <td className="py-1 pr-2 text-slate-100">
                      {item.org.name}
                    </td>
                    <td className="py-1 pr-2">{item.company.code}</td>
                    <td className="py-1 pr-2 text-slate-300">
                      {item.company.base_url}
                    </td>
                    <td className="py-1 pr-2 text-slate-300">
                      {Object.entries(item.org.features).map(([k, v]) => (
                        <div key={k}>
                          <span
                            className={
                              v ? "text-emerald-400 font-medium" : "text-slate-500"
                            }
                          >
                            {v ? "●" : "○"}
                          </span>{" "}
                          {k}
                        </div>
                      ))}
                    </td>
                    <td className="py-1 pr-2 text-slate-300">
                      {item.org.license.plan} –{" "}
                      {item.org.license.active ? "active" : "inactive"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminOrgs;
