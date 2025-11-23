// frontend/src/router.tsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { UserDashboard } from "./pages/UserDashboard";
import { AdminOverview } from "./pages/admin/AdminOverview";
import { AdminOrgs } from "./pages/admin/AdminOrgs";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { isLoggedIn, isAdmin } from "./lib/auth";

export const AppRouter: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />

      <Route
        path="/dashboard"
        element={
          isLoggedIn() && !isAdmin() ? <UserDashboard /> : <Navigate to="/" replace />
        }
      />

      <Route
        path="/admin"
        element={
          isLoggedIn() && isAdmin() ? (
            <AdminLayout>
              <AdminOverview />
            </AdminLayout>
          ) : (
            <Navigate to="/" replace />
          )
        }
      />

      <Route
        path="/admin/orgs"
        element={
          isLoggedIn() && isAdmin() ? (
            <AdminLayout>
              <AdminOrgs />
            </AdminLayout>
          ) : (
            <Navigate to="/" replace />
          )
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
