import { loadSession } from "./auth";
const base="/api";
export async function api<T>(path:string, init:RequestInit={}):Promise<T>{
  const s=loadSession();
  const headers:Record<string,string>={"Content-Type":"application/json",...(s?.token?{Authorization:`Bearer ${s.token}`}:{}) , ...(init.headers as any||{})};
  const res=await fetch(`${base}${path}`,{...init,headers});
  if (!res.ok) throw new Error(await res.text().catch(()=>res.statusText));
  const ct=res.headers.get("content-type")||"";
  return ct.includes("application/json")?await res.json() as T:await res.text() as any;
}
export const auth = {
  login:(payload:{access_code:string;username:string;password:string})=>api<{token:string;is_admin:boolean;username:string;display_name:string;org_id:null;org_name:null}>("/auth/login",{method:"POST",body:JSON.stringify(payload)}),
}
