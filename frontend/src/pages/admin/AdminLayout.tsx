// frontend/src/pages/admin/AdminLayout.tsx
import React from "react";
import { Outlet } from "react-router-dom";
import AdminSidebar from "../../components/AdminSidebar";
import useAuth, { logout } from "../../lib/auth";

const AdminLayout: React.FC = () => {
  const { user, loading } = useAuth();

  // Wait until auth is resolved so we don't render with an undefined user.
  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading admin...
      </div>
    );
  }

  const onLogout = () => {
    logout();
    window.location.href = "/app/";
  };

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100">
      <AdminSidebar />
      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-950/80 backdrop-blur">
          <div className="text-sm font-medium text-slate-200">
            Admin - {user.display_name} ({user.username})
          </div>
          <button
            onClick={onLogout}
            className="text-xs rounded-lg border border-slate-700 px-3 py-1 hover:bg-slate-800"
          >
            Logout
          </button>
        </header>
        <main className="flex-1 p-4 overflow-auto bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
