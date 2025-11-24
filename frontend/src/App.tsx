import React from "react";
import { useRoutes, Navigate } from "react-router-dom";
import { routes } from "./router";
import { useAuth } from "./lib/auth";

// Simple wrapper that redirects to /login if not authenticated
function AppRoutes() {
  const { user, loading } = useAuth();

  const element = useRoutes(routes);

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center text-gray-600">
        Loading...
      </div>
    );
  }

  // Not logged in → only allow /login
  const pathname = window.location.pathname.replace("/app", "") || "/";
  const isLogin = pathname === "/login";

  if (!user && !isLogin) {
    return <Navigate to="/login" replace />;
  }

  return element;
}

export default function App() {
  return <AppRoutes />;
}
