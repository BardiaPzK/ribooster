import { NavLink } from "react-router-dom";
import { LayoutDashboard, Building2, Ticket, Settings } from "lucide-react";

type NavItemProps = {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
};

function NavItem({ to, icon: Icon, label }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted",
        ].join(" ")
      }
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </NavLink>
  );
}

export function AdminSidebar() {
  return (
    <aside className="w-64 border-r bg-card flex flex-col">
      <div className="p-4 font-semibold text-lg">Admin Console</div>
      <nav className="flex-1 space-y-1 px-2">
        <NavItem to="/admin/overview" icon={LayoutDashboard} label="Overview" />
        <NavItem to="/admin/orgs" icon={Building2} label="Organizations" />
        <NavItem to="/admin/tickets" icon={Ticket} label="Tickets" />
        <NavItem to="/admin/settings" icon={Settings} label="Settings" />
      </nav>
    </aside>
  );
}
