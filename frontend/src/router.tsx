import React from "react";
import { RouteObject } from "react-router-dom";

// auth
import LoginPage from "./pages/LoginPage";

// user pages
import UserDashboard from "./pages/UserDashboard";
import ProjectBackup from "./pages/user/ProjectBackup";
import UserTickets from "./pages/user/UserTickets";
import TextToSql from "./pages/user/TextToSql";

// admin pages
import AdminLayout from "./pages/admin/AdminLayout";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminOrgs from "./pages/admin/AdminOrgs";
import AdminTickets from "./pages/admin/AdminTickets";
import AdminSettings from "./pages/admin/AdminSettings";

export const routes: RouteObject[] = [
  { path: "/login", element: <LoginPage /> },

  // USER
  {
    path: "/user",
    children: [
      { index: true, element: <UserDashboard /> },
      { path: "projects", element: <ProjectBackup /> },
      { path: "tickets", element: <UserTickets /> },
      { path: "text-sql", element: <TextToSql /> },
    ],
  },

  // ADMIN
  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      { index: true, element: <AdminOverview /> },
      { path: "orgs", element: <AdminOrgs /> },
      { path: "tickets", element: <AdminTickets /> },
      { path: "settings", element: <AdminSettings /> },
    ],
  },

  // default route
  { path: "/", element: <UserDashboard /> },
];
