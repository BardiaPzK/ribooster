// frontend/src/components/Sidebar.tsx
import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { clearAuthSession } from "../lib/auth";

export const Sidebar: React.FC = () => {
  const loc = useLocation();
  const nav = useNavigate();

  const isActive = (p: string) => loc.pathname === p;

  const logout = () => {
    clearAuthSession();
    nav("/");
  };

  return (
    <aside className="w-60 bg-slate-900/80 border-r border-slate-800/80 p-4 flex flex-col gap-4 rounded-2xl">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500" />
        <div className="font-semibold text-lg">ribooster</div>
      </div>
      <nav className="space-y-2 flex-1">
        <Link
          to="/dashboard"
          className={`block px-3 py-2 rounded-xl text-sm ${
            isActive("/dashboard") ? "bg-indigo-600 text-white" : "hover:bg-slate-800/80"
          }`}
        >
          User Dashboard
        </Link>
      </nav>
      <button
        onClick={logout}
        className="mt-auto px-3 py-2 rounded-xl text-sm bg-slate-800 border border-slate-700 hover:bg-slate-700"
      >
        Logout
      </button>
    </aside>
  );
};
