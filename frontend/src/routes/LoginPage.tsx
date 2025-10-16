import { FormEvent, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
  const { login, token } = useAuth();
  const nav = useNavigate();
  const [access_code, setAccess] = useState("");
  const [username, setUser] = useState("");
  const [password, setPass] = useState("");
  const [err, setErr] = useState<string|null>(null);
  const [busy, setBusy] = useState(false);

  if (token) {
    nav("/app", { replace: true });
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const r = await api.login({ access_code, username, password });
      login({
        token: r.token,
        is_admin: r.is_admin,
        username: r.username,
        display_name: r.display_name,
        org_id: r.org_id,
        org_name: r.org_name,
      });
      nav(r.is_admin ? "/admin" : "/app", { replace: true });
    } catch (e:any) {
      setErr(e.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container" style={{maxWidth:560}}>
      <div className="card">
        <h3>Sign in</h3>
        <p style={{color:"#aab2c5", marginTop:0}}>
          Use <span className="kbd">access_code</span> <b>admin</b> for admin console, with <span className="kbd">admin/admin</span> or <span className="kbd">admin2/admin2</span>.
        </p>
        <form onSubmit={onSubmit} className="grid" style={{gap:12}}>
          <div>
            <label className="label">Access Code</label>
            <input className="input" value={access_code} onChange={(e)=>setAccess(e.target.value)} placeholder="e.g. admin or AB-123" />
          </div>
          <div>
            <label className="label">Username</label>
            <input className="input" value={username} onChange={(e)=>setUser(e.target.value)} placeholder="username" />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={password} onChange={(e)=>setPass(e.target.value)} placeholder="password" />
          </div>
          {err && <div style={{color:"#ff6e6e"}}>{err}</div>}
          <div style={{display:"flex", gap:8}}>
            <button className="btn" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
            <button type="button" className="btn secondary" onClick={()=>nav("/")} disabled={busy}>Cancel</button>
          </div>
        </form>
      </div>
      <div style={{marginTop:12, color:"#aab2c5"}}>
        Need help? Check backend <span className="kbd">/health</span> via the top-right Actions later.
      </div>
    </div>
  );
}
