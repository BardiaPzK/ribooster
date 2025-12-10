// frontend/src/router.tsx
import { createBrowserRouter, Navigate } from "react-router-dom";
import useAuth from "./lib/auth";

// Pages
import LoginPage from "./pages/LoginPage";
import UserDashboard from "./pages/UserDashboard";

// Admin pages
import AdminLayout from "./pages/admin/AdminLayout";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminOrgs from "./pages/admin/AdminOrgs";
import AdminTickets from "./pages/admin/AdminTickets";
import AdminSettings from "./pages/admin/AdminSettings";

// User pages
import ProjectBackup from "./pages/user/ProjectBackup";
import UserTickets from "./pages/user/UserTickets";
import TextToSql from "./pages/user/TextToSql";
import Helpdesk from "./pages/user/Helpdesk";

// ─────────────────────────────────────────────
// Wrapper components for auth
// ─────────────────────────────────────────────

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-slate-500">Loading...</div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RequireAdmin({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-slate-500">Loading...</div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_admin) return <Navigate to="/dashboard" replace />;
  return children;
}

function RequireUser({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-slate-500">Loading...</div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (user.is_admin) return <Navigate to="/admin" replace />;
  return children;
}

// ─────────────────────────────────────────────
// Router definition
// ─────────────────────────────────────────────

// Define the routes separately so they can be consumed by both
// createBrowserRouter (for RouterProvider) and useRoutes (for
// existing App.tsx routing logic).
export const routes = [
  {
    path: "/",
    element: <Navigate to="/login" replace />,
  },

  // ───────────────────────────
  // LOGIN
  // ───────────────────────────
  {
    path: "/login",
    element: <LoginPage />,
  },

  // ───────────────────────────
  // ADMIN ROUTES
  // /admin/*
  // ───────────────────────────
  {
    path: "/admin",
    element: (
      <RequireAdmin>
        <AdminLayout />
      </RequireAdmin>
    ),
    children: [
      { index: true, element: <AdminOverview /> },
      { path: "overview", element: <AdminOverview /> },
      { path: "orgs", element: <AdminOrgs /> },
      { path: "tickets", element: <AdminTickets /> },
      { path: "settings", element: <AdminSettings /> },
    ],
  },

  // ───────────────────────────
  // USER ROUTES
  // /dashboard + /user/*
  // ───────────────────────────
  {
    path: "/dashboard",
    element: (
      <RequireUser>
        <UserDashboard />
      </RequireUser>
    ),
  },
  {
    path: "/user",
    children: [
      {
        index: true,
        element: (
          <RequireUser>
            <UserDashboard />
          </RequireUser>
        ),
      },
      {
        path: "backup",
        element: (
          <RequireUser>
            <ProjectBackup />
          </RequireUser>
        ),
      },
      {
        path: "projects",
        element: (
          <RequireUser>
            <ProjectBackup />
          </RequireUser>
        ),
      },
      {
        path: "tickets",
        element: (
          <RequireUser>
            <UserTickets />
          </RequireUser>
        ),
      },
      {
        path: "textsql",
        element: (
          <RequireUser>
            <TextToSql />
          </RequireUser>
        ),
      },
      {
        path: "text-sql",
        element: (
          <RequireUser>
            <TextToSql />
          </RequireUser>
        ),
      },
      {
        path: "helpdesk",
        element: (
          <RequireUser>
            <Helpdesk />
          </RequireUser>
        ),
      },
    ],
  },

  // ───────────────────────────
  // FALLBACK
  // ───────────────────────────
  {
    path: "*",
    element: <Navigate to="/login" replace />,
  },
];

export const router = createBrowserRouter(routes);

export default router;
