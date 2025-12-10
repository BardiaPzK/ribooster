// frontend/src/App.tsx
import React, { useEffect } from "react";
import { useLocation, useNavigate, useRoutes } from "react-router-dom";
import { routes } from "./router";
import useAuth from "./lib/auth";

const App: React.FC = () => {
  const { loading, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const element = useRoutes(routes);

  // Redirect authenticated users away from / or /login into their home.
  useEffect(() => {
    if (loading) return;
    const path = location.pathname;
    const atLogin = path.endsWith("/login") || path === "/login" || path === "/" || path === "/app" || path === "/app/";
    if (user && atLogin) {
      navigate(user.is_admin ? "/admin" : "/user", { replace: true });
    }
  }, [loading, user, location.pathname, navigate]);

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
