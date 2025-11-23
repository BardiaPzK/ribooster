import React, { useState } from "react";
import { api } from "../lib/api";

const LoginPage: React.FC = () => {
  const [accessCode, setAccessCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    try {
      const res = await api.POST("/auth/login", {
        access_code: accessCode.trim(),
        username: username.trim(),
        password
      });

      // Save session
      localStorage.setItem("token", res.token);
      localStorage.setItem("username", res.username);
      localStorage.setItem("display_name", res.display_name ?? res.username);
      localStorage.setItem("is_admin", String(res.is_admin));

      if (res.org_id) localStorage.setItem("org_id", res.org_id);
      if (res.company_id) localStorage.setItem("company_id", res.company_id);
      if (res.rib_exp_ts) localStorage.setItem("rib_exp_ts", String(res.rib_exp_ts));
      if (res.rib_role) localStorage.setItem("rib_role", res.rib_role);

      // Redirect by forcing full page navigation (best for Docker + Vite)
      if (res.is_admin) {
        window.location.href = "/admin/overview";
      } else {
        window.location.href = "/dashboard";
      }

    } catch (e: any) {
      setErr(e?.message || "Login failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
        <h1 className="text-2xl font-semibold text-center mb-6">
          Sign in to ribooster
        </h1>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Organization Code</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Admin or JBI-999"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Username</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              className="w-full border rounded-lg px-3 py-2"
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {err && <div className="text-red-600 text-sm">{err}</div>}

          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 text-white py-2 hover:bg-indigo-700"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
