import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { Navigate } from "react-router-dom";
import { api } from "../lib/api";
import Card from "../components/Card";

type Ticket = { id:number; org_id:number; subject:string; priority:string; status:string; created_at:number; updated_at:number };

export default function UserDashboard() {
  const { token, isAdmin, orgName } = useAuth();
  const [rows, setRows] = useState<Ticket[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [err, setErr] = useState<string|null>(null);
  const [busy, setBusy] = useState(false);

  if (!token) return <Navigate to="/login" replace />;
  if (isAdmin) return <Navigate to="/admin" replace />;

  const load = async () => {
    setBusy(true); setErr(null);
    try { setRows(await api.listTickets()); }
    catch (e:any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    try {
      await api.createTicket({ subject, body, priority: "normal" });
      setSubject(""); setBody(""); await load();
    } catch (e:any) { alert(e.message); }
  };

  return (
    <div className="container grid" style={{gap:16}}>
      <Card title={`Welcome${orgName ? " — " + orgName : ""}`} right={<button className="btn" onClick={load} disabled={busy}>Refresh</button>}>
        <div className="grid grid-2">
          <div>
            <h4 style={{marginTop:0}}>Create a Ticket</h4>
            <div className="grid" style={{gap:8}}>
              <div><label className="label">Subject</label><input className="input" value={subject} onChange={e=>setSubject(e.target.value)} /></div>
              <div><label className="label">Body</label><textarea className="textarea" rows={5} value={body} onChange={e=>setBody(e.target.value)} /></div>
              <div><button className="btn" onClick={create} disabled={!subject || !body}>Submit</button></div>
              {err && <div style={{color:"#ff6e6e"}}>{err}</div>}
            </div>
          </div>
          <div>
            <h4 style={{marginTop:0}}>Your Tickets</h4>
            <table className="table">
              <thead><tr><th>Subject</th><th>Status</th><th>Updated</th></tr></thead>
              <tbody>
                {rows.map(t => (
                  <tr key={t.id}>
                    <td>{t.subject}</td>
                    <td>{t.status}</td>
                    <td>{new Date(t.updated_at*1000).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}
