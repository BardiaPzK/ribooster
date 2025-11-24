import React from "react";
import { useRoutes, Navigate } from "react-router-dom";
import { routes } from "./router";
import useAuth from "./lib/auth";

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

  // Remove "/app" prefix and normalize
  const pathname = window.location.pathname.replace("/app", "") || "/";

  // Not logged in → redirect to login
  const isLogin = pathname === "/login";
  if (!user && !isLogin) {
    return <Navigate to="/login" replace />;
  }

  // --------------------------------------
  //  ADMIN ROUTING FIX
  // --------------------------------------

  if (user?.is_admin && !pathname.startsWith("/admin")) {
    return <Navigate to="/admin" replace />;
  }

  if (!user?.is_admin && pathname.startsWith("/admin")) {
    return <Navigate to="/dashboard" replace />;
  }


  return element;
}

export default function App() {
  return <AppRoutes />;
}
