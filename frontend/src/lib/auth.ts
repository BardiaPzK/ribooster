export type Session = { token:string; is_admin:boolean; username:string; display_name:string; org_id:null; org_name:null };
const KEY = "ribooster.session";
export const saveSession = (s:Session)=>localStorage.setItem(KEY, JSON.stringify(s));
export const loadSession = ():Session|null => { const r=localStorage.getItem(KEY); return r?JSON.parse(r):null; }
export const clearSession = ()=>localStorage.removeItem(KEY);
