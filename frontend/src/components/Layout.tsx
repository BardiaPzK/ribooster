// frontend/src/components/Layout.tsx
import React from "react";
import Sidebar from "./Sidebar";
import { logout } from "../lib/auth";

type Props = {
  children: React.ReactNode;
};

export default function Layout({ children }: Props) {
  function handleLogout() {
    logout();
    window.location.href = "/app/";
  }

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-50">
      <Sidebar onLogout={handleLogout} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
