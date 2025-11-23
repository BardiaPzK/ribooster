"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../lib/api";

export default function LoginPage() {
  const [accessCode, setAccessCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const router = useRouter();

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
      localStorage.setItem("org_id", res.org_id);
      localStorage.setItem("username", res.username);
      localStorage.setItem("display_name", res.display_name || res.username);
      localStorage.setItem("org_name", res.org_name || "");
      localStorage.setItem("is_admin", String(res.is_admin));

      if (res.rib_exp_ts) {
        localStorage.setItem("rib_exp_ts", String(res.rib_exp_ts));
      }
      if (res.rib_role) {
        localStorage.setItem("rib_role", String(res.rib_role));
      }

      // Redirect
      if (res.is_admin) {
        window.location.href = "/admin/overview";   // more reliable in Docker
      } else {
        window.location.href = "/dashboard";
      }

    } catch (e: any) {
      setErr(e?.message || "Login failed");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white shadow-soft rounded-2xl p-6">
        <h1 className="text-2xl font-semibold mb-4">Sign in to ribooster</h1>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Organization Code</label>
            <input
              className="w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-brand"
              placeholder="Admin or AA-123"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Username</label>
            <input
              className="w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-brand"
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
              className="w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-brand"
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {err && <div className="text-red-600 text-sm">{err}</div>}

          <button
            type="submit"
            className="w-full bg-brand hover:bg-brand-dark text-white rounded-xl py-2 font-medium transition"
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}
