// frontend/src/router.tsx
import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import UserDashboard from "./pages/UserDashboard";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminOrgs from "./pages/admin/AdminOrgs";
import AdminTickets from "./pages/admin/AdminTickets";
import AdminSettings from "./pages/admin/AdminSettings";
import { api, MeResponse } from "./lib/api";
import { clearAuthSession, getAuthToken } from "./lib/auth";

const LoadingScreen: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
    <div className="text-sm text-slate-400">Loading…</div>
  </div>
);

const RequireUser: React.FC<{ children: (me: MeResponse) => React.ReactNode }> = ({ children }) => {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    const check = async () => {
      const token = getAuthToken();
      if (!token) {
        nav("/", { replace: true });
        return;
      }
      try {
        const m = await api.me();
        if (m.is_admin) {
          nav("/admin", { replace: true });
          return;
        }
        setMe(m);
      } catch {
        clearAuthSession();
        nav("/", { replace: true });
        return;
      } finally {
        setLoading(false);
      }
    };
    check();
  }, [nav]);

  if (loading || !me) return <LoadingScreen />;
  return <>{children(me)}</>;
};

const RequireAdmin: React.FC<{ children: (me: MeResponse) => React.ReactNode }> = ({ children }) => {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    const check = async () => {
      const token = getAuthToken();
      if (!token) {
        nav("/", { replace: true });
        return;
      }
      try {
        const m = await api.me();
        if (!m.is_admin) {
          nav("/dashboard", { replace: true });
          return;
        }
        setMe(m);
      } catch {
        clearAuthSession();
        nav("/", { replace: true });
        return;
      } finally {
        setLoading(false);
      }
    };
    check();
  }, [nav]);

  if (loading || !me) return <LoadingScreen />;
  return <>{children(me)}</>;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />

      <Route
        path="/dashboard"
        element={
          <RequireUser>
            {(me) => <UserDashboard me={me} />}
          </RequireUser>
        }
      />

      <Route
        path="/admin/*"
        element={
          <RequireAdmin>
            {(me) => <AdminLayout me={me} />}
          </RequireAdmin>
        }
      >
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<AdminOverview />} />
        <Route path="orgs" element={<AdminOrgs />} />
        <Route path="tickets" element={<AdminTickets />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
