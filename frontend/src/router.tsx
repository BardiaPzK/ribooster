// frontend/src/router.tsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import UserDashboard from "./pages/UserDashboard";
import UserTickets from "./pages/user/UserTickets";
import ProjectBackup from "./pages/user/ProjectBackup";
import TextToSql from "./pages/user/TextToSql";

import AdminLayout from "./pages/admin/AdminLayout";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminOrgs from "./pages/admin/AdminOrgs";

// If you have an AdminTickets page later, you can add it here.

const AppRouter: React.FC = () => {
  return (
    <Routes>
      {/* Login */}
      <Route path="/" element={<LoginPage />} />

      {/* User area */}
      <Route path="/dashboard" element={<UserDashboard />} />
      <Route path="/tickets" element={<UserTickets />} />
      <Route path="/projects/backup" element={<ProjectBackup />} />
      <Route path="/text-to-sql" element={<TextToSql />} />

      {/* Admin area */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminOverview />} />
        <Route path="orgs" element={<AdminOrgs />} />
        {/* e.g. <Route path="tickets" element={<AdminTickets />} /> later */}
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRouter;
