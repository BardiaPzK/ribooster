import React, { createContext, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadSession, saveSession, clearSession, Session } from "../lib/auth";

export const AuthCtx = createContext({
  token:null as string|null, isAdmin:false, username:null as string|null, displayName:null as string|null,
  login: (s:Session)=>{}, logout: ()=>{}
});

export const AuthProvider: React.FC<React.PropsWithChildren> = ({children})=>{
  const nav = useNavigate();
  const [s,setS]=useState<Session|null>(loadSession());
  const ctx = useMemo(()=>({
    token:s?.token||null,
    isAdmin:!!s?.is_admin,
    username:s?.username||null,
    displayName:s?.display_name||null,
    login:(x:Session)=>{ setS(x); saveSession(x); },
    logout:()=>{ clearSession(); setS(null); nav("/login",{replace:true}); }
  }),[s,nav]);
  return <AuthCtx.Provider value={ctx}>{children}</AuthCtx.Provider>;
};
