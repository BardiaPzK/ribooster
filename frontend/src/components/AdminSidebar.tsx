// frontend/src/components/AdminSidebar.tsx
import React from "react";
import { NavLink } from "react-router-dom";

type NavItemProps = {
  to: string;
  label: string;
};

const navLinkBase =
  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors";

function NavItem({ to, label }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          navLinkBase,
          isActive
            ? "bg-indigo-600/10 text-indigo-400"
            : "text-slate-400 hover:bg-slate-800 hover:text-slate-100",
        ].join(" ")
      }
    >
      <span className="inline-block w-2 h-2 rounded-full bg-slate-500" />
      <span>{label}</span>
    </NavLink>
  );
}

export const AdminSidebar: React.FC = () => {
  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-950/70 backdrop-blur flex flex-col">
      <div className="p-4 border-b border-slate-800">
        <div className="text-xs uppercase tracking-widest text-slate-500">
          ribooster
        </div>
        <div className="text-lg font-semibold text-slate-100">
          Admin Console
        </div>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-1">
        <NavItem to="/admin/overview" label="Overview" />
        <NavItem to="/admin/orgs" label="Organizations" />
        <NavItem to="/admin/tickets" label="Tickets" />
        <NavItem to="/admin/settings" label="Settings" />
      </nav>
    </aside>
  );
};

export default AdminSidebar;
