import { FormEvent, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../lib/api";
import { AuthCtx } from "../providers/AuthProvider";

export default function LoginPage(){
  const nav=useNavigate();
  const { login, token } = useContext(AuthCtx);
  const [access_code,setAccess]=useState("admin");
  const [username,setUser]=useState("admin");
  const [password,setPass]=useState("Torodi1992");
  const [err,setErr]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);

  if (token) nav("/admin", {replace:true});

  const onSubmit=async(e:FormEvent)=>{ e.preventDefault(); setErr(null); setBusy(true);
    try{
      const r = await auth.login({access_code, username, password});
      login({ token:r.token, is_admin:r.is_admin, username:r.username, display_name:r.display_name, org_id:null, org_name:null });
      nav("/admin", {replace:true});
    }catch(ex:any){ setErr(ex.message||"Login failed"); } finally{ setBusy(false); }
  };

  return (
    <div className="container" style={{maxWidth:520}}>
      <div className="card">
        <h3>Admin Sign in</h3>
        <form onSubmit={onSubmit} className="grid" style={{gap:12}}>
          <div><label className="label">Access Code</label><input className="input" value={access_code} onChange={e=>setAccess(e.target.value)}/></div>
          <div><label className="label">Username</label><input className="input" value={username} onChange={e=>setUser(e.target.value)}/></div>
          <div><label className="label">Password</label><input className="input" type="password" value={password} onChange={e=>setPass(e.target.value)}/></div>
          {err && <div style={{color:"#ff6e6e"}}>{err}</div>}
          <div style={{display:"flex",gap:8}}>
            <button className="btn" disabled={busy}>{busy?"Signing in...":"Sign in"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
