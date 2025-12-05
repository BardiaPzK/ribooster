// frontend/src/App.tsx
import React, { useEffect } from "react";
import { useRoutes, Navigate } from "react-router-dom";
import { routes } from "./router";
import useAuth, { logout } from "./lib/auth";
import { api } from "./lib/api";

function AppRoutes() {
  const element = useRoutes(routes);
  const { user, loading } = useAuth();

  // Proactively validate any cached session (e.g., after a redeploy or on
  // browsers that kept a stale token). If the token is no longer valid,
  // immediately clear it so the user is sent back to /login instead of being
  // redirected to /admin with an "Invalid session" message.
  useEffect(() => {
    let cancelled = false;
    if (!user) return;

    api
      .me()
      .catch(() => {
        if (cancelled) return;
        logout();
      });

    return () => {
      cancelled = true;
    };
  }, [user?.token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  // Because BrowserRouter uses basename="/app", strip that for routing logic
  const rawPath = window.location.pathname;
  const pathname =
    rawPath.startsWith("/app") ? rawPath.slice("/app".length) || "/" : rawPath || "/";

  const isLogin = pathname === "/login";

  // Not logged in → always send to /login (except already there)
  if (!user && !isLogin) {
    return <Navigate to="/login" replace />;
  }

  // Logged-in admin → force everything to /admin…
  if (user?.is_admin) {
    if (!pathname.startsWith("/admin")) {
      return <Navigate to="/admin" replace />;
    }
  }
  // Logged-in normal user
  else if (user) {
    // block /admin for non-admins
    if (pathname.startsWith("/admin")) {
      return <Navigate to="/user" replace />;
    }
    // If coming from "/" or "/login" after login, send to user dashboard
    if (pathname === "/" || pathname === "/login") {
      return <Navigate to="/user" replace />;
    }
  }

  return element;
}

const App: React.FC = () => {
  return <AppRoutes />;
};

export default App;
