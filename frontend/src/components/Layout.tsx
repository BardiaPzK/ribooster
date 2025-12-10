// frontend/src/components/Layout.tsx
import React, { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import { logout } from "../lib/auth";
import { api, UserContext } from "../lib/api";

type Props = {
  children: React.ReactNode;
};

export default function Layout({ children }: Props) {
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [licenseActive, setLicenseActive] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .userContext()
      .then((ctx: UserContext) => {
        if (cancelled) return;
        setFeatures(ctx.company?.features || {});
        setLicenseActive(ctx.org?.license?.active !== false);
      })
      .catch(() => {
        if (cancelled) return;
        setFeatures({});
        setLicenseActive(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleLogout() {
    logout();
    window.location.href = "/app/";
  }

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-50">
      <Sidebar
        onLogout={handleLogout}
        features={features}
        licenseActive={licenseActive !== false}
      />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
