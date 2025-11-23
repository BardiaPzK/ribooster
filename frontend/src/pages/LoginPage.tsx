// frontend/src/pages/LoginPage.tsx

import React, { useState } from "react";
import { login } from "../api"; // adjust import if your api helper lives elsewhere
import "./LoginPage.css"; // optional

type Props = {};

export default function LoginPage(_props: Props) {
  const [companyCode, setCompanyCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await login({ company_code: companyCode, username, password });

      // store session in localStorage
      localStorage.setItem("token", res.token);
      localStorage.setItem("is_admin", String(res.is_admin));
      if (res.display_name) localStorage.setItem("display_name", res.display_name);
      if (res.org_id) localStorage.setItem("org_id", res.org_id);
      if (res.org_name) localStorage.setItem("org_name", res.org_name);
      if (res.company_id) localStorage.setItem("company_id", res.company_id);
      if (res.company_code) localStorage.setItem("company_code", res.company_code);
      if (res.rib_exp_ts) localStorage.setItem("rib_exp_ts", String(res.rib_exp_ts));
      if (res.rib_role) localStorage.setItem("rib_role", res.rib_role);

      // FORCE REDIRECT to avoid router issues
      if (res.is_admin) {
        window.location.href = "/app/admin";
      } else {
        window.location.href = "/app/dashboard";
      }
    } catch (err: any) {
      console.error("Login error", err);
      setError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
      <div className="w-full max-w-md bg-slate-900/80 border border-slate-700 rounded-2xl p-6 shadow-xl">
        <h1 className="text-2xl font-semibold mb-4 text-center">Sign in to ribooster</h1>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm mb-1">Company Code</label>
            <input
              className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-sm"
              value={companyCode}
              onChange={(e) => setCompanyCode(e.target.value)}
              placeholder="e.g. TNG-100 or Admin"
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Username</label>
            <input
              className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-sm"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="RIB username or admin"
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Password</label>
            <input
              type="password"
              className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <div className="text-sm text-red-400">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 py-2 text-sm font-medium"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
