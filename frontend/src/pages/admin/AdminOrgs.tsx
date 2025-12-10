// frontend/src/pages/admin/AdminOrgs.tsx
import React, { useEffect, useMemo, useState } from "react";
import { api, OrgListItem, Company, Payment } from "../../lib/api";

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

const toDateInput = (ts?: number | null) => {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  return d.toISOString().slice(0, 10); // yyyy-MM-dd
};

const fromDateInput = (v: string) => {
  if (!v) return null;
  const dt = new Date(v + "T00:00:00Z");
  return Math.floor(dt.getTime() / 1000);
};

const AdminOrgs: React.FC = () => {
  const [orgs, setOrgs] = useState<OrgListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // search + selection
  const [search, setSearch] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  // edit org
  const [editOrgName, setEditOrgName] = useState("");
  const [editContactEmail, setEditContactEmail] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");

  // edit company
  const [editBaseUrl, setEditBaseUrl] = useState("");
  const [editRibCompanyCode, setEditRibCompanyCode] = useState("");
  const [editCompanyCode, setEditCompanyCode] = useState("");
  const [editAllowedUsersStr, setEditAllowedUsersStr] = useState("");
  const [editAiKey, setEditAiKey] = useState("");
  const [editFeatures, setEditFeatures] = useState<Record<string, boolean>>({});
  const [editPlan, setEditPlan] = useState<"trial" | "monthly" | "yearly">("trial");
  const [editActive, setEditActive] = useState(true);
  const [editExpiry, setEditExpiry] = useState("");

  // payments
  const [payments, setPayments] = useState<Payment[]>([]);
  const [payDate, setPayDate] = useState("");
  const [payAmount, setPayAmount] = useState<string>("");
  const [payDesc, setPayDesc] = useState("");

  // new company
  const [newCompanyCode, setNewCompanyCode] = useState("");
  const [newBaseUrl, setNewBaseUrl] = useState("");
  const [newRibCompany, setNewRibCompany] = useState("999");
  const [newAllowedUsersStr, setNewAllowedUsersStr] = useState("");
  const [newAiKey, setNewAiKey] = useState("");
  const [newPlan, setNewPlan] = useState<"trial" | "monthly" | "yearly">("trial");
  const [newExpiry, setNewExpiry] = useState("");
  const [newFeatures, setNewFeatures] = useState<Record<string, boolean>>({ ...defaultFeatures });
  // new org
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgContactEmail, setNewOrgContactEmail] = useState("");
  const [newOrgCompanyCode, setNewOrgCompanyCode] = useState("");
  const [newOrgBaseUrl, setNewOrgBaseUrl] = useState("");
  const [newOrgRibCode, setNewOrgRibCode] = useState("999");
  const [newOrgAllowedUsers, setNewOrgAllowedUsers] = useState("");
  const [newOrgPlan, setNewOrgPlan] = useState<"trial" | "monthly" | "yearly">("trial");
  const [newOrgExpiry, setNewOrgExpiry] = useState("");

  const loadPayments = async (companyId?: string | null) => {
    if (!companyId) {
      setPayments([]);
      return;
    }
    try {
      const data = await api.admin.listPayments(companyId);
      setPayments(data);
    } catch (e) {
      // ignore silently in UI
      setPayments([]);
    }
  };

  const load = () => {
    setLoading(true);
    api.admin
      .listOrgs()
      .then(async (data) => {
        setOrgs(data);
        let orgId = selectedOrgId;
        let companyId = selectedCompanyId;
        if (!orgId && data[0]) {
          orgId = data[0].org.org_id;
        }
        const org = data.find((o) => o.org.org_id === orgId) || data[0];
        if (org) {
          if (!companyId) {
            companyId = org.companies?.[0]?.company_id || org.company?.company_id || null;
          }
          setSelectedOrgId(org.org.org_id);
          setSelectedCompanyId(companyId || null);
          await loadPayments(companyId || null);
        }
      })
      .catch((e: any) => setError(e?.message || "Failed to load orgs"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // populate edit fields on selection
  useEffect(() => {
    if (!selectedOrg || !selectedCompany) return;
    setEditOrgName(selectedOrg.org.name);
    setEditContactEmail(selectedOrg.org.contact_email || "");
    setEditContactPhone(selectedOrg.org.contact_phone || "");

    setEditBaseUrl(selectedCompany.base_url);
    setEditRibCompanyCode(selectedCompany.rib_company_code);
    setEditCompanyCode(selectedCompany.code);
    setEditAllowedUsersStr((selectedCompany.allowed_users || []).join(", "));
    setEditAiKey(selectedCompany.ai_api_key || "");
    setEditFeatures({ ...defaultFeatures, ...selectedCompany.features });
    setEditPlan(selectedCompany.license?.plan || "trial");
    setEditActive(selectedCompany.license?.active !== false);
    setEditExpiry(toDateInput(selectedCompany.license?.current_period_end));
    loadPayments(selectedCompany.company_id);
  }, [selectedOrg, selectedCompany]);

  // reset new company feature toggles when switching org
  useEffect(() => {
    setNewFeatures({ ...defaultFeatures });
  }, [selectedOrgId]);

  const saveSelected = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrg || !selectedCompany) return;
    setError(null);
    try {
      await api.admin.updateOrg(selectedOrg.org.org_id, {
        name: editOrgName.trim(),
        contact_email: editContactEmail.trim() || undefined,
        contact_phone: editContactPhone.trim() || undefined,
      });

      await api.admin.updateCompany(selectedCompany.company_id, {
        base_url: editBaseUrl.trim(),
        rib_company_code: editRibCompanyCode.trim(),
        company_code: editCompanyCode.trim(),
        allowed_users: editAllowedUsersStr
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        ai_api_key: editAiKey.trim() || null,
        features: editFeatures,
        plan: editPlan,
        active: editActive,
        current_period_end: fromDateInput(editExpiry),
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
        features: newFeatures,
        plan: newPlan,
        current_period_end: fromDateInput(newExpiry),
        active: true,
      });
      setNewCompanyCode("");
      setNewBaseUrl("");
      setNewRibCompany("999");
      setNewAllowedUsersStr("");
      setNewAiKey("");
      setNewPlan("trial");
      setNewExpiry("");
      setNewFeatures({ ...defaultFeatures });
      setSelectedCompanyId(created.company_id);
      load();
    } catch (e: any) {
      setError(e?.message || "Failed to create company");
    }
  };

  const addPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;
    setError(null);
    try {
      const midnight = payDate ? new Date(payDate + "T00:00:00") : new Date();
      await api.admin.addPayment(selectedCompany.company_id, {
        payment_date: Math.floor(midnight.getTime() / 1000),
        amount_cents: Math.round((parseFloat(payAmount || "0") || 0) * 100),
        description: payDesc || undefined,
      });
      await loadPayments(selectedCompany.company_id);
      load();
      setPayDesc("");
      setPayAmount("");
    } catch (e: any) {
      setError(e?.message || "Failed to add payment");
    }
  };

  const deletePayment = async (id: number) => {
    if (!window.confirm("Delete this payment log?")) return;
    try {
      await api.admin.deletePayment(id);
      await loadPayments(selectedCompanyId);
      load();
    } catch (e: any) {
      setError(e?.message || "Failed to delete payment");
    }
  };

  const deleteCompany = async () => {
    if (!selectedCompany) return;
    if (!window.confirm("Delete this company and its payments?")) return;
    try {
      await api.admin.deleteCompany(selectedCompany.company_id);
      setSelectedCompanyId(null);
      load();
    } catch (e: any) {
      setError(e?.message || "Failed to delete company");
    }
  };

  const deleteOrg = async () => {
    if (!selectedOrg) return;
    if (!window.confirm("Delete this organization, its companies, and payments?")) return;
    try {
      await api.admin.deleteOrg(selectedOrg.org.org_id);
      setSelectedOrgId(null);
      setSelectedCompanyId(null);
      load();
    } catch (e: any) {
      setError(e?.message || "Failed to delete organization");
    }
  };

  const createOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const created = await api.admin.createOrg({
        name: newOrgName.trim(),
        contact_email: newOrgContactEmail.trim() || undefined,
        base_url: newOrgBaseUrl.trim(),
        rib_company_code: newOrgRibCode.trim(),
        company_code: newOrgCompanyCode.trim(),
        allowed_users: newOrgAllowedUsers
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        company_plan: newOrgPlan,
        company_current_period_end: fromDateInput(newOrgExpiry) || undefined,
        company_active: true,
      });
      setNewOrgName("");
      setNewOrgContactEmail("");
      setNewOrgCompanyCode("");
      setNewOrgBaseUrl("");
      setNewOrgRibCode("999");
      setNewOrgAllowedUsers("");
      setNewOrgPlan("trial");
      setNewOrgExpiry("");
      setSelectedOrgId(created.org.org_id);
      setSelectedCompanyId(created.company?.company_id || null);
      load();
    } catch (e: any) {
      setError(e?.message || "Failed to create organization");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-lg font-semibold text-slate-100">Organizations & Companies</div>
        <input
          className="w-56 rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Search org / company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {error && <div className="text-sm text-red-400">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
        <div className="lg:col-span-1 rounded-2xl border border-slate-800 bg-slate-900/70 p-3 space-y-3">
          <div className="font-medium text-slate-200">Organizations</div>
          {/* Create org */}
          <form className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2" onSubmit={createOrg}>
            <div className="text-[11px] font-medium text-slate-300">Create organization</div>
            <input
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Org name"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              required
            />
            <input
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Contact email"
              value={newOrgContactEmail}
              onChange={(e) => setNewOrgContactEmail(e.target.value)}
            />
            <input
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Company code"
              value={newOrgCompanyCode}
              onChange={(e) => setNewOrgCompanyCode(e.target.value)}
              required
            />
            <input
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="RIB base URL"
              value={newOrgBaseUrl}
              onChange={(e) => setNewOrgBaseUrl(e.target.value)}
              required
            />
            <input
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="RIB company code"
              value={newOrgRibCode}
              onChange={(e) => setNewOrgRibCode(e.target.value)}
            />
            <select
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
              value={newOrgPlan}
              onChange={(e) => setNewOrgPlan(e.target.value as "trial" | "monthly" | "yearly")}
            >
              <option value="trial">trial</option>
              <option value="monthly">monthly</option>
              <option value="yearly">yearly</option>
            </select>
            <label className="block text-[11px] text-slate-400">Expiry (optional)</label>
            <input
              type="datetime-local"
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
              value={newOrgExpiry}
              onChange={(e) => setNewOrgExpiry(e.target.value)}
            />
            <textarea
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              rows={2}
              placeholder="Allowed users (comma separated)"
              value={newOrgAllowedUsers}
              onChange={(e) => setNewOrgAllowedUsers(e.target.value)}
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs px-3 py-1.5"
            >
              Create org
            </button>
          </form>
          {loading ? (
            <div className="text-slate-500">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-slate-500">No organizations.</div>
          ) : (
            <div className="space-y-2 max-h-[520px] overflow-auto">
              {filtered.map((item) => (
                <button
                  key={item.org.org_id}
                  className={`w-full text-left rounded-xl border px-3 py-2 transition ${
                    item.org.org_id === selectedOrgId
                      ? "border-indigo-500 bg-indigo-500/10 text-indigo-100"
                      : "border-slate-800 bg-slate-950 text-slate-200 hover:border-slate-700"
                  }`}
                  onClick={() => {
                    setSelectedOrgId(item.org.org_id);
                    setSelectedCompanyId(item.companies[0]?.company_id || item.company?.company_id || null);
                  }}
                >
                  <div className="font-semibold">{item.org.name}</div>
                  <div className="text-[11px] text-slate-400">
                    {item.companies.map((c) => c.code).join(", ")}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Add company */}
          {selectedOrg && (
            <form onSubmit={createCompany} className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2">
              <div className="font-medium text-slate-200">Add company</div>
              <input
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Company code"
                value={newCompanyCode}
                onChange={(e) => setNewCompanyCode(e.target.value)}
                required
              />
              <input
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="RIB base URL"
                value={newBaseUrl}
                onChange={(e) => setNewBaseUrl(e.target.value)}
                required
              />
              <input
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="RIB company code"
                value={newRibCompany}
                onChange={(e) => setNewRibCompany(e.target.value)}
              />
              <select
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                value={newPlan}
                onChange={(e) => setNewPlan(e.target.value as "trial" | "monthly" | "yearly")}
              >
                <option value="trial">trial</option>
                <option value="monthly">monthly</option>
                <option value="yearly">yearly</option>
              </select>
              <label className="block text-[11px] text-slate-400">Expiry (optional)</label>
              <input
                type="datetime-local"
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                value={newExpiry}
                onChange={(e) => setNewExpiry(e.target.value)}
              />
              <textarea
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                rows={2}
                placeholder="Allowed users (comma separated)"
                value={newAllowedUsersStr}
                onChange={(e) => setNewAllowedUsersStr(e.target.value)}
              />
              <input
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="OpenAI API key (optional)"
                value={newAiKey}
                onChange={(e) => setNewAiKey(e.target.value)}
              />
              <div className="space-y-1">
                <div className="text-[11px] font-medium text-slate-300">Services</div>
                {serviceOptions.map((svc) => (
                  <label key={svc.key} className="flex items-center justify-between text-[11px] text-slate-300">
                    <span>{svc.label}</span>
                    <button
                      type="button"
                      onClick={() => setNewFeatures((prev) => ({ ...prev, [svc.key]: !prev[svc.key] }))}
                      className={`relative inline-flex h-5 w-10 items-center rounded-full transition ${
                        newFeatures[svc.key] !== false ? "bg-indigo-500" : "bg-slate-700"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                          newFeatures[svc.key] !== false ? "translate-x-5" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </label>
                ))}
              </div>
              <button
                type="submit"
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs px-3 py-1.5 w-full"
              >
                Add company
              </button>
            </form>
          )}
        </div>

        <div className="lg:col-span-2 space-y-3">
          {selectedOrg && selectedCompany ? (
            <>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{selectedOrg.org.name}</div>
                    <div className="text-[11px] text-slate-400">
                      Org ID: {selectedOrg.org.org_id} • Companies:{" "}
                      {selectedOrg.companies.map((c) => c.code).join(", ")}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <select
                      className="rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                      value={selectedCompanyId || selectedCompany.company_id}
                      onChange={(e) => setSelectedCompanyId(e.target.value)}
                    >
                      {selectedOrg.companies.map((c) => (
                        <option key={c.company_id} value={c.company_id}>
                          {c.code}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={deleteCompany}
                      className="rounded-lg border border-red-600 text-red-300 px-2 py-1 text-[11px] hover:bg-red-900/30"
                    >
                      Delete company
                    </button>
                    <button
                      type="button"
                      onClick={deleteOrg}
                      className="rounded-lg border border-red-600 text-red-300 px-2 py-1 text-[11px] hover:bg-red-900/30"
                    >
                      Delete org
                    </button>
                  </div>
                </div>

                <form className="grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={saveSelected}>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-0.5">Org name</label>
                      <input
                        className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                        value={editOrgName}
                        onChange={(e) => setEditOrgName(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-0.5">Contact email</label>
                        <input
                          className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                          value={editContactEmail}
                          onChange={(e) => setEditContactEmail(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-0.5">Contact phone</label>
                        <input
                          className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                          value={editContactPhone}
                          onChange={(e) => setEditContactPhone(e.target.value)}
                        />
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
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-0.5">License plan</label>
                        <select
                          className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                          value={editPlan}
                          onChange={(e) => setEditPlan(e.target.value as "trial" | "monthly" | "yearly")}
                        >
                          <option value="trial">trial</option>
                          <option value="monthly">monthly</option>
                          <option value="yearly">yearly</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-0.5">Expiry</label>
                        <input
                          type="date"
                          className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                          value={editExpiry}
                          onChange={(e) => setEditExpiry(e.target.value)}
                        />
                      </div>
                    </div>
                    <label className="inline-flex items-center gap-2 text-[11px] text-slate-300">
                      <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
                      License active
                    </label>

                    <div className="border-t border-slate-800 pt-2">
                      <div className="text-[11px] font-medium text-slate-300 mb-1">Services</div>
                      <div className="space-y-1">
                        {serviceOptions.map((svc) => (
                          <label
                            key={svc.key}
                            className="flex items-center justify-between text-[11px] text-slate-300"
                          >
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

                    <div className="border-t border-slate-800 pt-2 space-y-2">
                      <div className="text-[11px] font-medium text-slate-300">Payments</div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          className="rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                          value={payDate}
                          onChange={(e) => setPayDate(e.target.value)}
                          required
                        />
                        <input
                          type="number"
                          step="0.01"
                          className="rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="Amount in EUR (e.g., 88.99)"
                          value={payAmount}
                          onChange={(e) => setPayAmount(e.target.value)}
                        />
                        <input
                          className="rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="Description"
                          value={payDesc}
                          onChange={(e) => setPayDesc(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={addPayment}
                          className="col-span-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs px-3 py-1.5"
                        >
                          Add payment & update license
                        </button>
                      </div>
                      <div className="max-h-36 overflow-auto space-y-1 rounded-lg border border-slate-800 bg-slate-950 p-2">
                        {payments.map((p) => (
                          <div
                            key={p.id}
                            className="rounded-md bg-slate-900 px-2 py-1 text-[11px] text-slate-200 shadow-sm shadow-slate-950/50 flex items-center justify-between gap-2"
                          >
                            <div>
                              <div className="flex justify-between gap-2">
                                <span>{(p.amount_cents / 100).toFixed(2)} {p.currency}</span>
                                <span>{new Date((p.period_start || p.created_at) * 1000).toLocaleDateString()}</span>
                              </div>
                              <div className="text-slate-400">
                                Period end: {p.period_end ? new Date(p.period_end * 1000).toLocaleDateString() : "n/a"} •{" "}
                                Added: {new Date(p.created_at * 1000).toLocaleDateString()} • By: {p.added_by || "admin"} •{" "}
                                {p.description || "no desc"}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => deletePayment(p.id)}
                              className="text-red-400 hover:text-red-300"
                              title="Delete payment"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        {!payments.length && <div className="text-[11px] text-slate-500">No payments logged.</div>}
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-2 flex justify-end pt-2 border-t border-slate-800">
                    <button
                      type="submit"
                      className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs px-4 py-2"
                    >
                      Save changes
                    </button>
                  </div>
                </form>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-slate-500 text-xs">
              Select an organization to view details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminOrgs;
