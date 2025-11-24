import React from "react";
import { RouteObject } from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import UserDashboard from "./pages/UserDashboard";

// user services
import ProjectBackup from "./pages/user/ProjectBackup";
import UserTickets from "./pages/user/UserTickets";
// if you make a Text-to-SQL page:
import TextSqlPage from "./pages/user/TextSqlPage";

// admin pages
import AdminLayout from "./pages/admin/AdminLayout";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminOrgs from "./pages/admin/AdminOrgs";

export const routes: RouteObject[] = [
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: <UserDashboard />, // default after login
  },
  {
    path: "/user",
    children: [
      { index: true, element: <UserDashboard /> },
      { path: "projects", element: <ProjectBackup /> },
      { path: "tickets", element: <UserTickets /> },
      { path: "text-sql", element: <TextSqlPage /> }, // new service
    ],
  },
  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      { index: true, element: <AdminOverview /> },
      { path: "orgs", element: <AdminOrgs /> },
    ],
  },
];
