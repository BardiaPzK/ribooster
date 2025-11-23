// frontend/src/pages/LoginPage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { setAuthSession, isLoggedIn, isAdmin } from "../lib/auth";

const LoginPage: React.FC = () => {
  const [companyCode, setCompanyCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    if (isLoggedIn()) {
      nav(isAdmin() ? "/admin" : "/dashboard", { replace: true });
    }
  }, [nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.login(companyCode.trim(), username.trim(), password);
      setAuthSession(res);
      nav(res.is_admin ? "/admin" : "/dashboard", { replace: true });
    } catch (err: any) {
      setError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-500 mb-3" />
          <h1 className="text-2xl font-semibold">Sign in to ribooster</h1>
          <p className="text-sm text-slate-400 mt-1">
            Use your company code and RIB credentials. For admin use{" "}
            <span className="font-mono">Admin / admin / admin</span>.
          </p>
        </div>
        <form onSubmit={submit} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-4">
          <div>
            <label className="block text-sm mb-1">Company Code</label>
            <input
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. TNG-100 or Admin"
              value={companyCode}
              onChange={(e) => setCompanyCode(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Username</label>
            <input
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Password</label>
            <input
              type="password"
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="text-sm text-red-400">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white py-2 text-sm font-medium transition disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
