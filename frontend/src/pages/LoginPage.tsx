// frontend/src/pages/LoginPage.tsx
import React, { useState } from "react";
import { login } from "../lib/auth";

export default function LoginPage() {
  const [companyCode, setCompanyCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const sess = await login(companyCode, username, password);
      const dest = sess.is_admin ? "/app/admin" : "/app/user";
      window.location.href = dest;
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h1 className="text-xl font-semibold text-slate-50 mb-2">ribooster login</h1>
        <p className="text-xs text-slate-400 mb-4">
          Enter your company code and RIB credentials.
        </p>

        <form onSubmit={handleSubmit} autoComplete="off" className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">
              Company Code
            </label>
            <input
              type="text"
              autoComplete="off"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500"
              placeholder="e.g. Admin"
              value={companyCode}
              onChange={(e) => setCompanyCode(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Username</label>
            <input
              type="text"
              autoComplete="off"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500"
              placeholder="e.g. admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Password</label>
            <input
              type="password"
              autoComplete="new-password"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-950/40 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !companyCode || !username || !password}
            className="w-full rounded-lg bg-indigo-600 text-slate-50 text-sm font-medium py-2.5 mt-1 hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
