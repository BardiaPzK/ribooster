// frontend/src/components/Layout.tsx
import React from "react";
import Sidebar from "./Sidebar";
import { logout } from "../lib/auth";


type Props = {
  title?: string;
  children: React.ReactNode;
};

const Layout: React.FC<Props> = ({ title, children }) => {
  const onLogout = () => {
    logout();
    window.location.href = "/app/";
  };

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b border-slate-800 flex items-center justify-between px-4">
          <div className="text-sm font-medium text-slate-200">
            {title || "Dashboard"}
          </div>
          <button
            onClick={onLogout}
            className="text-xs rounded-lg border border-slate-700 px-3 py-1 hover:bg-slate-800"
          >
            Logout
          </button>
        </header>
        <main className="flex-1 p-4 overflow-auto bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
