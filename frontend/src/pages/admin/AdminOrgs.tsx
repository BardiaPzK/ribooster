// frontend/src/pages/admin/AdminOrgs.tsx
import React, { useEffect, useState } from "react";
import { api, OrgListItem } from "../../lib/api";

const AdminOrgs: React.FC = () => {
  const [orgs, setOrgs] = useState<OrgListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // create org form
  const [name, setName] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [ribCompanyCode, setRibCompanyCode] = useState("999");
  const [contactEmail, setContactEmail] = useState("");
  const [allowedUsersStr, setAllowedUsersStr] = useState("");

  // search + selection
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // edit fields
  const [editOrgName, setEditOrgName] = useState("");
  const [editContactEmail, setEditContactEmail] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  const [editPlan, setEditPlan] = useState<"monthly" | "yearly">("monthly");
  const [editActive, setEditActive] = useState(true);
  const [editFeatures, setEditFeatures] = useState<Record<string, boolean>>({});
  const [editBaseUrl, setEditBaseUrl] = useState("");
  const [editRibCompanyCode, setEditRibCompanyCode] = useState("");
  const [editCompanyCode, setEditCompanyCode] = useState("");
  const [editAllowedUsersStr, setEditAllowedUsersStr] = useState("");
  const [editAiKey, setEditAiKey] = useState("");

  const load = () => {
    setLoading(true);
    api.admin
      .listOrgs()
      .then((data) => {
        setOrgs(data);
        if (!selectedId && data[0]) {
          setSelectedId(data[0].org.org_id);
        }
      })
      .catch((e: any) => setError(e?.message || "Failed to load orgs"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const selected = orgs.find((o) => o.org.org_id === selectedId) || null;

  // whenever selection changes, populate edit fields
  useEffect(() => {
    if (!selected) return;
    const { org, company } = selected;

    setEditOrgName(org.name);
    setEditContactEmail(org.contact_email || "");
    setEditContactPhone(org.contact_phone || "");
    setEditPlan(org.license.plan);
    setEditActive(org.license.active);
    setEditFeatures({
      "projects.backup": !!org.features["projects.backup"],
      "ai.helpdesk": !!org.features["ai.helpdesk"],
      ...org.features,
    });
    setEditBaseUrl(company.base_url);
    setEditRibCompanyCode(company.rib_company_code);
    setEditCompanyCode(company.code);
    setEditAllowedUsersStr((company.allowed_users || []).join(", "));
    setEditAiKey(company.ai_api_key || "");
  }, [selected]);

  const saveSelected = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    try {
      // update org
      await api.admin.updateOrg(selected.org.org_id, {
        name: editOrgName.trim(),
        contact_email: editContactEmail.trim() || undefined,
        contact_phone: editContactPhone.trim() || undefined,
        plan: editPlan,
        active: editActive,
        features: editFeatures,
      });

      // update company
      await api.admin.updateCompany(selected.company.company_id, {
        base_url: editBaseUrl.trim(),
        rib_company_code: editRibCompanyCode.trim(),
        company_code: editCompanyCode.trim(),
        allowed_users: editAllowedUsersStr
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        ai_api_key: editAiKey.trim() || undefined,
      });

      load();
    } catch (e: any) {
      setError(e?.message || "Failed to update organization");
    }
  };

  const filtered = orgs.filter((item) => {
    const term = search.toLowerCase();
    if (!term) return true;
    return (
      item.org.name.toLowerCase().includes(term) ||
      item.company.code.toLowerCase().includes(term)
    );
  });

  const toggleFeature = (key: string) => {
    setEditFeatures((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-lg font-semibold text-slate-100">Organizations</div>
        <input
          className="w-56 rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Search org / company…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <div className="text-sm text-red-400">{error}</div>}

      {/* Create org */}
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

      {/* Existing orgs + edit panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="font-medium mb-2 text-slate-200">Existing orgs</div>
          {loading ? (
            <div className="text-slate-500">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-slate-500">No organizations found.</div>
          ) : (
            <div className="overflow-auto max-h-72">
              <table className="w-full text-left">
                <thead className="text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-1 pr-2">Org</th>
                    <th className="py-1 pr-2">Company code</th>
                    <th className="py-1 pr-2">RIB URL</th>
                    <th className="py-1 pr-2">License</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr
                      key={item.org.org_id}
                      className={`border-b border-slate-900/60 cursor-pointer ${
                        item.org.org_id === selectedId ? "bg-slate-800/60" : "hover:bg-slate-800/40"
                      }`}
                      onClick={() => setSelectedId(item.org.org_id)}
                    >
                      <td className="py-1 pr-2 text-slate-100">{item.org.name}</td>
                      <td className="py-1 pr-2">{item.company.code}</td>
                      <td className="py-1 pr-2 text-slate-300">
                        {item.company.base_url}
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

        {/* Edit panel */}
        <div className="lg:col-span-1 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-2">
          <div className="font-medium text-slate-200 mb-1">Edit organization</div>
          {selected ? (
            <form className="space-y-2" onSubmit={saveSelected}>
              <div>
                <label className="block text-[11px] mb-0.5 text-slate-400">
                  Org name
                </label>
                <input
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  value={editOrgName}
                  onChange={(e) => setEditOrgName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] mb-0.5 text-slate-400">
                    Contact email
                  </label>
                  <input
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                    value={editContactEmail}
                    onChange={(e) => setEditContactEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[11px] mb-0.5 text-slate-400">
                    Contact phone
                  </label>
                  <input
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                    value={editContactPhone}
                    onChange={(e) => setEditContactPhone(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 items-center">
                <div>
                  <label className="block text-[11px] mb-0.5 text-slate-400">
                    Plan
                  </label>
                  <select
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-[11px] outline-none focus:ring-2 focus:ring-indigo-500"
                    value={editPlan}
                    onChange={(e) => setEditPlan(e.target.value as "monthly" | "yearly")}
                  >
                    <option value="monthly">monthly</option>
                    <option value="yearly">yearly</option>
                  </select>
                </div>
                <label className="inline-flex items-center gap-2 text-[11px] text-slate-300 mt-4">
                  <input
                    type="checkbox"
                    checked={editActive}
                    onChange={(e) => setEditActive(e.target.checked)}
                  />
                  License active
                </label>
              </div>

              <div className="border-t border-slate-800 pt-2">
                <div className="text-[11px] font-medium text-slate-300 mb-1">
                  Services
                </div>
                <div className="space-y-1">
                  <label className="flex items-center gap-2 text-[11px] text-slate-300">
                    <input
                      type="checkbox"
                      checked={!!editFeatures["projects.backup"]}
                      onChange={() => toggleFeature("projects.backup")}
                    />
                    Project backup
                  </label>
                  <label className="flex items-center gap-2 text-[11px] text-slate-300">
                    <input
                      type="checkbox"
                      checked={!!editFeatures["ai.helpdesk"]}
                      onChange={() => toggleFeature("ai.helpdesk")}
                    />
                    RIB Helpdesk AI
                  </label>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-2 space-y-1">
                <div className="text-[11px] font-medium text-slate-300">
                  Company settings
                </div>
                <input
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Company code"
                  value={editCompanyCode}
                  onChange={(e) => setEditCompanyCode(e.target.value)}
                />
                <input
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="RIB base URL"
                  value={editBaseUrl}
                  onChange={(e) => setEditBaseUrl(e.target.value)}
                />
                <input
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="RIB company code (e.g. 999)"
                  value={editRibCompanyCode}
                  onChange={(e) => setEditRibCompanyCode(e.target.value)}
                />
                <textarea
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  rows={2}
                  placeholder="Allowed users (comma separated)"
                  value={editAllowedUsersStr}
                  onChange={(e) => setEditAllowedUsersStr(e.target.value)}
                />
                <input
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="OpenAI API key (optional)"
                  value={editAiKey}
                  onChange={(e) => setEditAiKey(e.target.value)}
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs px-3 py-1.5"
                >
                  Save changes
                </button>
              </div>
            </form>
          ) : (
            <div className="text-slate-500 text-xs">
              Select an organization from the list to edit.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminOrgs;
