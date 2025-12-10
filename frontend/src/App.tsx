// frontend/src/App.tsx
import React, { useEffect } from "react";
import { useLocation, useNavigate, useRoutes } from "react-router-dom";
import { routes } from "./router";
import useAuth from "./lib/auth";

const App: React.FC = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const element = useRoutes(routes);

  useEffect(() => {
    if (loading) return;

    // Strip basename "/app" for checks
    const rawPath = location.pathname;
    const path = rawPath.startsWith("/app") ? rawPath.slice("/app".length) || "/" : rawPath || "/";
    const isLogin = path === "/login" || path === "/";
    const isAdminPath = path.startsWith("/admin");

    if (!user) {
      if (!isLogin) navigate("/login", { replace: true });
      return;
    }

    if (user.is_admin) {
      if (!isAdminPath) navigate("/admin", { replace: true });
    } else {
      if (isAdminPath) navigate("/user", { replace: true });
      else if (isLogin || path === "/") navigate("/user", { replace: true });
    }
  }, [user, loading, location.pathname, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading...
      </div>
    );
  }

  return element;
};

export default App;
