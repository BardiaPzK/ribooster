// frontend/src/components/Sidebar.tsx
import React from "react";
import { NavLink, useLocation } from "react-router-dom";

type SidebarProps = {
  onLogout?: () => void;
  isAdmin?: boolean;
};

const Sidebar: React.FC<SidebarProps> = ({ onLogout, isAdmin }) => {
  const location = useLocation();

  const userLinks = [
    { to: "/dashboard", label: "Overview" },
    { to: "/tickets", label: "Support Tickets" },
    { to: "/projects/backup", label: "Project Backup" },
    { to: "/text-to-sql", label: "Text to SQL" },
  ];

  // Admin nav is handled in AdminSidebar, this one is mainly user sidebar.
  const isActive = (path: string) => location.pathname === path;

  return (
    <aside className="w-64 min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      <div className="px-4 py-4 border-b border-slate-700">
        <div className="text-lg font-semibold">ribooster</div>
        <div className="text-xs text-slate-400">
          {isAdmin ? "Admin" : "User Dashboard"}
        </div>
      </div>

      {!isAdmin && (
        <nav className="flex-1 px-2 py-4 space-y-1">
          {userLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={`block px-3 py-2 rounded-md text-sm ${
                isActive(link.to)
                  ? "bg-slate-800 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      )}

      {onLogout && (
        <button
          onClick={onLogout}
          className="m-3 mt-auto px-3 py-2 rounded-md text-sm bg-slate-800 text-slate-100 hover:bg-slate-700"
        >
          Logout
        </button>
      )}
    </aside>
  );
};

export default Sidebar;
