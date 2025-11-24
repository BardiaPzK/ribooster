// frontend/src/pages/LoginPage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, isLoggedIn, isAdmin, getSession, logout } from "../lib/auth";

const LoginPage: React.FC = () => {
  const nav = useNavigate();

  const [companyCode, setCompanyCode] = useState("Admin");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect
  useEffect(() => {
    if (isLoggedIn()) {
      nav(isAdmin() ? "/admin" : "/user", { replace: true });
    }
  }, [nav]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const sess = await login(companyCode.trim(), username.trim(), password);
      console.log("Logged in:", sess);

      if (sess.is_admin) {
        nav("/admin", { replace: true });
      } else {
        nav("/user", { replace: true });
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    logout();
    setCompanyCode("Admin");
    setUsername("admin");
    setPassword("admin");
    setError(null);
  }

  const existing = getSession();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow p-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">ribooster Login</h1>
          <p className="text-sm text-slate-500 mt-1">
            Sign in with your company code and RIB user.
          </p>
        </div>

        {existing && (
          <div className="text-xs bg-emerald-50 border border-emerald-200 rounded p-2 text-emerald-800 flex justify-between items-center">
            <span>
              Already logged in as <b>{existing.username}</b>{" "}
              {existing.is_admin ? "(admin)" : ""}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="ml-2 text-[11px] underline"
            >
              Logout
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1 text-sm">
            <label className="font-medium text-slate-800">Company Code</label>
            <input
              type="text"
              className="w-full rounded border border-slate-300 px-2 py-1"
              value={companyCode}
              onChange={(e) => setCompanyCode(e.target.value)}
              placeholder="Admin or e.g. TNG-100"
            />
          </div>

          <div className="space-y-1 text-sm">
            <label className="font-medium text-slate-800">Username</label>
            <input
              type="text"
              className="w-full rounded border border-slate-300 px-2 py-1"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your RIB username"
            />
          </div>

          <div className="space-y-1 text-sm">
            <label className="font-medium text-slate-800">Password</label>
            <input
              type="password"
              className="w-full rounded border border-slate-300 px-2 py-1"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded p-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-blue-600 text-white text-sm py-2 hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="text-[11px] text-slate-400">
          Admin demo: Company code <b>Admin</b>, user <b>admin</b>, password{" "}
          <b>admin</b>.
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
