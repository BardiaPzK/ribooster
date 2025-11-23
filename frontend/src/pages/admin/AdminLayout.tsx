// frontend/src/pages/admin/AdminLayout.tsx
import React from "react";
import { AdminSidebar } from "../../components/AdminSidebar";

export const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen flex gap-4 p-4">
    <AdminSidebar />
    <main className="flex-1 space-y-6">{children}</main>
  </div>
);
