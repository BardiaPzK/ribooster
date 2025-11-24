// frontend/src/router.tsx
import React, { useEffect, useState } from "react";
import type { RouteObject } from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import UserDashboard from "./pages/UserDashboard";
import ProjectBackup from "./pages/user/ProjectBackup";
import UserTickets from "./pages/user/UserTickets";
import TextToSql from "./pages/user/TextToSql";

import AdminLayout from "./pages/admin/AdminLayout";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminOrgs from "./pages/admin/AdminOrgs";
import AdminTickets from "./pages/admin/AdminTickets";
import AdminSettings from "./pages/admin/AdminSettings";

import { api, MeResponse } from "./lib/api";

// Wrapper that loads /api/admin/me and then renders AdminLayout with props
const AdminLayoutRoute: React.FC = () => {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const m = await api.me();
        if (!cancelled) {
          setMe(m);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Failed to load admin user");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading admin…
      </div>
    );
  }

  if (error || !me) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500">
        {error || "Admin session missing"}
      </div>
    );
  }

  return <AdminLayout me={me} />;
};

export const routes: RouteObject[] = [
  {
    path: "/login",
    element: <LoginPage />,
  },

  // USER AREA
  {
    path: "/user",
    children: [
      {
        index: true,
        element: <UserDashboard />,
      },
      {
        path: "projects",
        element: <ProjectBackup />,
      },
      {
        path: "tickets",
        element: <UserTickets />,
      },
      {
        path: "text-sql",
        element: <TextToSql />,
      },
    ],
  },

  // ADMIN AREA
  {
    path: "/admin",
    element: <AdminLayoutRoute />,
    children: [
      {
        index: true,
        element: <AdminOverview />,
      },
      {
        path: "orgs",
        element: <AdminOrgs />,
      },
      {
        path: "tickets",
        element: <AdminTickets />,
      },
      {
        path: "settings",
        element: <AdminSettings />,
      },
    ],
  },

  // Optional alias so /app/text-to-sql still works if you link to it
  {
    path: "/text-to-sql",
    element: <TextToSql />,
  },

  // Root → user dashboard by default
  {
    path: "/",
    element: <UserDashboard />,
  },
];
