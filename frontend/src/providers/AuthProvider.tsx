import React, { createContext, useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { saveSession, loadSession, clearSession, Session } from "../lib/auth";

type Ctx = {
  token: string | null;
  isAdmin: boolean;
  username: string | null;
  displayName: string | null;
  orgId: number | null;
  orgName: string | null;
  login: (s: Session) => void;
  logout: () => void;
};

export const AuthCtx = createContext<Ctx>({
  token: null, isAdmin: false, username: null, displayName: null, orgId: null, orgName: null,
  login: () => {}, logout: () => {},
});

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const nav = useNavigate();
  const [session, setSession] = useState<Session | null>(() => loadSession());

  const value = useMemo<Ctx>(() => ({
    token: session?.token || null,
    isAdmin: !!session?.is_admin,
    username: session?.username || null,
    displayName: session?.display_name || null,
    orgId: session?.org_id ?? null,
    orgName: session?.org_name ?? null,
    login: (s) => { setSession(s); saveSession(s); },
    logout: () => { setSession(null); clearSession(); nav("/login", { replace: true }); },
  }), [session, nav]);

  // One-time token refresh hook would go here

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
};
