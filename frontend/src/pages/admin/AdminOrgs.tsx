// frontend/src/pages/admin/AdminOrgs.tsx
import React, { useEffect, useMemo, useState } from "react";
import { api, OrgListItem, Company } from "../../lib/api";

const serviceOptions = [
  { key: "projects.backup", label: "Project backup" },
  { key: "ai.helpdesk", label: "RIB Helpdesk AI" },
  { key: "textsql", label: "Text to SQL" },
];

const defaultFeatures: Record<string, boolean> = {
  "projects.backup": true,
  "ai.helpdesk": true,
  textsql: true,
};

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
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

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

  // add company form
  const [newCompanyCode, setNewCompanyCode] = useState("");
  const [newBaseUrl, setNewBaseUrl] = useState("");
  const [newRibCompany, setNewRibCompany] = useState("999");
  const [newAllowedUsersStr, setNewAllowedUsersStr] = useState("");
  const [newAiKey, setNewAiKey] = useState("");

  const load = () => {
    setLoading(true);
    api.admin
      .listOrgs()
      .then((data) => {
        setOrgs(data);
        if (!selectedOrgId && data[0]) {
          setSelectedOrgId(data[0].org.org_id);
          const firstCompany = data[0].companies?.[0] || data[0].company;
          setSelectedCompanyId(firstCompany?.company_id ?? null);
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
      const created = await api.admin.createOrg(payload);
      setName("");
      setCompanyCode("");
      setBaseUrl("");
      setRibCompanyCode("999");
      setContactEmail("");
      setAllowedUsersStr("");
      setSelectedOrgId(created.org.org_id);
      setSelectedCompanyId(created.company?.company_id ?? created.companies?.[0]?.company_id ?? null);
      load();
    } catch (e: any) {
      setError(e?.message || "Failed to create organization");
    }
  };

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return orgs.filter((item) => {
      if (!term) return true;
      return (
        item.org.name.toLowerCase().includes(term) ||
        item.companies.some((c) => c.code.toLowerCase().includes(term))
      );
    });
  }, [orgs, search]);

  const selectedOrg = useMemo(() => orgs.find((o) => o.org.org_id === selectedOrgId) || null, [orgs, selectedOrgId]);
  const selectedCompany: Company | null = useMemo(() => {
    if (!selectedOrg) return null;
    if (selectedCompanyId) {
      const match = selectedOrg.companies.find((c) => c.company_id === selectedCompanyId);
      if (match) return match;
    }
    return selectedOrg.companies[0] || selectedOrg.company || null;
  }, [selectedOrg, selectedCompanyId]);

  // whenever selection changes, populate edit fields
  useEffect(() => {
    if (!selectedOrg || !selectedCompany) return;
    const { org } = selectedOrg;
    const company = selectedCompany;

    setEditOrgName(org.name);
    setEditContactEmail(org.contact_email || "");
    setEditContactPhone(org.contact_phone || "");
    setEditPlan(org.license.plan);
    setEditActive(org.license.active);
    setEditFeatures({ ...defaultFeatures, ...company.features });
    setEditBaseUrl(company.base_url);
    setEditRibCompanyCode(company.rib_company_code);
    setEditCompanyCode(company.code);
    setEditAllowedUsersStr((company.allowed_users || []).join(", "));
    setEditAiKey(company.ai_api_key || "");
  }, [selectedOrg, selectedCompany]);

  const saveSelected = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrg || !selectedCompany) return;
    setError(null);
    try {
      // update org
      await api.admin.updateOrg(selectedOrg.org.org_id, {
        name: editOrgName.trim(),
        contact_email: editContactEmail.trim() || undefined,
        contact_phone: editContactPhone.trim() || undefined,
        plan: editPlan,
        active: editActive,
      });

      // update selected company
      await api.admin.updateCompany(selectedCompany.company_id, {
        base_url: editBaseUrl.trim(),
        rib_company_code: editRibCompanyCode.trim(),
        company_code: editCompanyCode.trim(),
        allowed_users: editAllowedUsersStr
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        ai_api_key: editAiKey.trim() || null,
        features: Object.keys(editFeatures).length ? editFeatures : defaultFeatures,
      });
      load();
    } catch (e: any) {
      setError(e?.message || "Failed to save organization");
    }
  };

  const toggleFeature = (key: string) => {
    setEditFeatures((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const createCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrg) return;
    try {
      const created = await api.admin.createCompany(selectedOrg.org.org_id, {
        base_url: newBaseUrl.trim(),
        rib_company_code: newRibCompany.trim(),
        company_code: newCompanyCode.trim(),
        allowed_users: newAllowedUsersStr
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        ai_api_key: newAiKey.trim() || undefined,
        features: Object.keys(editFeatures).length ? editFeatures : defaultFeatures,
      });
      setNewCompanyCode("");
      setNewBaseUrl("");
      setNewRibCompany("999");
      setNewAllowedUsersStr("");
      setNewAiKey("");
      setSelectedCompanyId(created.company_id);
      load();
    } catch (e: any) {
      setError(e?.message || "Failed to create company");
    }
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
                    <th className="py-1 pr-2">Companies</th>
                    <th className="py-1 pr-2">License</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr
                      key={item.org.org_id}
                      className={`border-b border-slate-900/60 cursor-pointer ${
                        item.org.org_id === selectedOrgId ? "bg-slate-800/60" : "hover:bg-slate-800/40"
                      }`}
                      onClick={() => {
                        setSelectedOrgId(item.org.org_id);
                        setSelectedCompanyId(item.companies[0]?.company_id || null);
                      }}
                    >
                      <td className="py-1 pr-2 text-slate-100">{item.org.name}</td>
                      <td className="py-1 pr-2 text-slate-300">
                        {item.companies.map((c) => c.code).join(", ")}
                      </td>
                      <td className="py-1 pr-2 text-slate-300">
                        {item.org.license.plan} – {item.org.license.active ? "active" : "inactive"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Edit panel */}
        <div className="lg:col-span-1 space-y-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-2">
            <div className="font-medium text-slate-200 mb-1">Edit organization</div>
            {selectedOrg && selectedCompany ? (
              <form className="space-y-2" onSubmit={saveSelected}>
                <div>
                  <label className="block text-[11px] mb-0.5 text-slate-400">Org name</label>
                  <input
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                    value={editOrgName}
                    onChange={(e) => setEditOrgName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] mb-0.5 text-slate-400">Contact email</label>
                    <input
                      className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                      value={editContactEmail}
                      onChange={(e) => setEditContactEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] mb-0.5 text-slate-400">Contact phone</label>
                    <input
                      className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                      value={editContactPhone}
                      onChange={(e) => setEditContactPhone(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 items-center">
                  <div>
                    <label className="block text-[11px] mb-0.5 text-slate-400">Plan</label>
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
                  <div className="text-[11px] font-medium text-slate-300 mb-1">Company</div>
                  <select
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                    value={selectedCompany.company_id}
                    onChange={(e) => setSelectedCompanyId(e.target.value)}
                  >
                    {selectedOrg.companies.map((c) => (
                      <option key={c.company_id} value={c.company_id}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="border-t border-slate-800 pt-2">
                  <div className="text-[11px] font-medium text-slate-300 mb-1">Services</div>
                  <div className="space-y-1">
                    {serviceOptions.map((svc) => (
                      <label key={svc.key} className="flex items-center justify-between text-[11px] text-slate-300">
                        <span>{svc.label}</span>
                        <button
                          type="button"
                          onClick={() => toggleFeature(svc.key)}
                          className={`relative inline-flex h-5 w-10 items-center rounded-full transition ${
                            editFeatures[svc.key] ? "bg-indigo-500" : "bg-slate-700"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                              editFeatures[svc.key] ? "translate-x-5" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-2 space-y-1">
                  <div className="text-[11px] font-medium text-slate-300">Company settings</div>
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
              <div className="text-slate-500 text-xs">Select an organization from the list to edit.</div>
            )}
          </div>

          {/* Add company */}
          {selectedOrg && (
            <form
              onSubmit={createCompany}
              className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-2"
            >
              <div className="font-medium text-slate-200">Add company code</div>
              <input
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Company code"
                value={newCompanyCode}
                onChange={(e) => setNewCompanyCode(e.target.value)}
                required
              />
              <input
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="RIB base URL"
                value={newBaseUrl}
                onChange={(e) => setNewBaseUrl(e.target.value)}
                required
              />
              <input
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="RIB company code"
                value={newRibCompany}
                onChange={(e) => setNewRibCompany(e.target.value)}
              />
              <textarea
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                rows={2}
                placeholder="Allowed users (comma separated)"
                value={newAllowedUsersStr}
                onChange={(e) => setNewAllowedUsersStr(e.target.value)}
              />
              <input
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="OpenAI API key (optional)"
                value={newAiKey}
                onChange={(e) => setNewAiKey(e.target.value)}
              />
              <button
                type="submit"
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs px-3 py-1.5"
              >
                Add company
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminOrgs;
