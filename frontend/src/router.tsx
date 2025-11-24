// frontend/src/router.tsx
import React from "react";
import {
  createBrowserRouter,
  Navigate,
} from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminOrgs from "./pages/admin/OrgListPage";
import AdminTickets from "./pages/admin/AdminTicketsPage";

import UserDashboard from "./pages/user/UserDashboard";
import UserTickets from "./pages/user/TicketsPage";
import UserTicketView from "./pages/user/TicketViewPage";
import UserProjects from "./pages/user/ProjectsPage";
import UserHelpdesk from "./pages/user/HelpdeskPage";
import TextToSql from "./pages/user/TextToSql";

import useAuth, { isAdmin, isLoggedIn } from "./lib/auth";


// ─────────────────────────────────────────────
// Helper routes
// ─────────────────────────────────────────────

// Wrapper: requires ANY logged-in session
function RequireAuth({ children }: { children: JSX.Element }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

// Wrapper: requires admin session
function RequireAdmin({ children }: { children: JSX.Element }) {
  const { user } = useAuth();

  if (!user || !user.is_admin) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

// Wrapper: requires user (not admin)
function RequireUser({ children }: { children: JSX.Element }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (user.is_admin) return <Navigate to="/admin" replace />;

  return children;
}


// ─────────────────────────────────────────────
// Main Router
// ─────────────────────────────────────────────
const router = createBrowserRouter([
  //
  // LOGIN
  //
  {
    path: "/login",
    element: <LoginPage />,
  },

  //
  // ROOT → check session → go to admin or user
  //
  {
    path: "/",
    element: (
      <AuthRedirect />
    ),
  },

  //
  // ADMIN ROUTES
  //
  {
    path: "/admin",
    element: (
      <RequireAdmin>
        <AdminDashboard />
      </RequireAdmin>
    ),
  },
  {
    path: "/admin/organizations",
    element: (
      <RequireAdmin>
        <AdminOrgs />
      </RequireAdmin>
    ),
  },
  {
    path: "/admin/tickets",
    element: (
      <RequireAdmin>
        <AdminTickets />
      </RequireAdmin>
    ),
  },

  //
  // USER ROUTES
  //
  {
    path: "/user",
    element: (
      <RequireUser>
        <UserDashboard />
      </RequireUser>
    ),
  },
  {
    path: "/user/tickets",
    element: (
      <RequireUser>
        <UserTickets />
      </RequireUser>
    ),
  },
  {
    path: "/user/tickets/:ticket_id",
    element: (
      <RequireUser>
        <UserTicketView />
      </RequireUser>
    ),
  },
  {
    path: "/user/projects",
    element: (
      <RequireUser>
        <UserProjects />
      </RequireUser>
    ),
  },
  {
    path: "/user/helpdesk",
    element: (
      <RequireUser>
        <UserHelpdesk />
      </RequireUser>
    ),
  },
  {
    path: "/user/textsql",
    element: (
      <RequireUser>
        <TextToSql />
      </RequireUser>
    ),
  },

  //
  // FALLBACK → send to login
  //
  {
    path: "*",
    element: <Navigate to="/login" replace />,
  },
]);


// ─────────────────────────────────────────────
// Redirect logic at root "/"
// ─────────────────────────────────────────────
function AuthRedirect() {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (user.is_admin) return <Navigate to="/admin" replace />;
  return <Navigate to="/user" replace />;
}


export default router;
