// frontend/src/pages/UserDashboard.tsx
import React, { useEffect, useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { api } from "../lib/api";

export const UserDashboard: React.FC = () => {
  const [displayName, setDisplayName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [companyCode, setCompanyCode] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const me: any = await api.me();
        setDisplayName(me.display_name || me.username || "");
        setOrgName(me.org_name || "");
        setCompanyCode(me.company_code || "");
      } catch {
        // fallback from localStorage
        const dn =
          localStorage.getItem("display_name") || localStorage.getItem("username") || "";
        const on = localStorage.getItem("org_name") || "";
        const cc = localStorage.getItem("company_code") || "";
        setDisplayName(dn);
        setOrgName(on);
        setCompanyCode(cc);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen flex gap-4 p-4">
      <Sidebar />
      <main className="flex-1 space-y-6">
        <section className="card p-6">
          <h1 className="text-2xl font-semibold">
            Welcome {displayName} {orgName ? `· ${orgName}` : ""} 👋
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Company Code: <span className="font-mono">{companyCode || "-"}</span>
          </p>
          <p className="text-sm text-slate-400 mt-3">
            This dashboard will later show your enabled services (project backup, helpdesk,…).
            For now it confirms a successful login via RIB server.
          </p>
        </section>
      </main>
    </div>
  );
};
