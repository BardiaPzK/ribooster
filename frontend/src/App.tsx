// frontend/src/App.tsx
import React, { useEffect, useMemo } from "react";
import { useLocation, useNavigate, useRoutes } from "react-router-dom";
import { routes } from "./router";
import useAuth from "./lib/auth";

const App: React.FC = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const element = useRoutes(routes);

  // Strip /app basename
  const path = useMemo(() => {
    const raw = location.pathname;
    return raw.startsWith("/app") ? raw.slice("/app".length) || "/" : raw || "/";
  }, [location.pathname]);

  useEffect(() => {
    if (loading) return;

    const isLogin = path === "/login" || path === "/";
    const isAdminPath = path.startsWith("/admin");
    const isUserPath = path.startsWith("/user") || path.startsWith("/dashboard");

    // No user: only allow login
    if (!user) {
      if (!isLogin) navigate("/login", { replace: true });
      return;
    }

    // Admin routing
    if (user.is_admin) {
      if (!isAdminPath) navigate("/admin", { replace: true });
      return;
    }

    // User routing
    if (isAdminPath) {
      navigate("/user", { replace: true });
    } else if (isLogin || path === "/") {
      navigate("/user", { replace: true });
    } else if (!isUserPath) {
      // Any other path for user -> dashboard
      navigate("/user", { replace: true });
    }
  }, [user, loading, path, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading...
      </div>
    );
  }

  // Temporary debug banner to confirm path/user; remove once fixed
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="bg-amber-900/50 text-amber-100 text-xs px-3 py-2">
        Path: {path} | user: {user ? `${user.username} (${user.is_admin ? "admin" : "user"})` : "none"}
      </div>
      {element}
    </div>
  );
};

export default App;
