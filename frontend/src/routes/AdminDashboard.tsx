import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { Navigate } from "react-router-dom";
import { api } from "../lib/api";
import Card from "../components/Card";

type OrgRow = {
  org: {
    org_id: number; name: string; base_url: string; company_code: string; access_code: string;
    contact_email?: string; contact_phone?: string; notes?: string; deactivated: boolean; last_login_ts?: number|null;
  };
  license?: { plan: string|null; active: boolean; current_period_end: number };
  features: string[];
  requests_count: number;
};

export default function AdminDashboard() {
  const { token, isAdmin } = useAuth();
  const [rows, setRows] = useState<OrgRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string|null>(null);

  // create form
  const [name, setName] = useState("");
  const [base_url, setBaseUrl] = useState("");
  const [company_code, setCompanyCode] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [schemaFile, setSchemaFile] = useState<File | null>(null);

  if (!token) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/app" replace />;

  const load = async () => {
    setBusy(true); setErr(null);
    try {
      const data = await api.adminListOrgs();
      setRows(data);
    } catch (e:any) { setErr(e.message || "Failed to load"); }
    finally { setBusy(false); }
  };

  useEffect(() => { load(); }, []);

  const createOrg = async () => {
    try {
      await api.adminCreateOrg({ name, base_url, company_code });
      setName(""); setBaseUrl(""); setCompanyCode("");
      await load();
    } catch (e:any) { alert(e.message); }
  };

  const toggleFeature = async (org_id: number, feat: string, enabled: boolean) => {
    try { await api.adminToggleFeatures(org_id, [feat], enabled); await load(); } catch (e:any) { alert(e.message); }
  };

  const activateMonthly = async (org_id: number) => {
    try { await api.adminPurchase(org_id, "monthly"); await load(); } catch (e:any) { alert(e.message); }
  };

  const saveOpenAI = async (org_id: number) => {
    try { await api.adminSetOpenAIKey(org_id, openaiKey); setOpenaiKey(""); alert("Saved"); } catch (e:any) { alert(e.message); }
  };

  const uploadSchema = async () => {
    if (!schemaFile) return;
    try { await api.adminUploadSchema(schemaFile); alert("Schema uploaded"); }
    catch (e:any) { alert(e.message); }
  };

  return (
    <div className="container grid" style={{gap:16}}>
      <Card title="Organizations" right={<button className="btn" onClick={load} disabled={busy}>Refresh</button>}>
        {err && <div style={{color:"#ff6e6e"}}>{err}</div>}
        <div className="grid grid-2" style={{marginBottom:16}}>
          <div className="card">
            <h4 style={{marginTop:0}}>Create Organization</h4>
            <div className="grid" style={{gap:8}}>
              <div><label className="label">Name</label><input className="input" value={name} onChange={e=>setName(e.target.value)} /></div>
              <div><label className="label">Base URL</label><input className="input" value={base_url} onChange={e=>setBaseUrl(e.target.value)} placeholder="https://rib-server/itwo40/services" /></div>
              <div><label className="label">Company Code</label><input className="input" value={company_code} onChange={e=>setCompanyCode(e.target.value)} placeholder="999" /></div>
              <div style={{display:"flex", gap:8}}><button className="btn" onClick={createOrg}>Create</button></div>
            </div>
          </div>
          <div className="card">
            <h4 style={{marginTop:0}}>Global Schema (Data Query Studio)</h4>
            <div className="grid" style={{gap:8}}>
              <input type="file" onChange={(e)=>setSchemaFile(e.target.files?.[0]||null)} />
              <button className="btn" onClick={uploadSchema} disabled={!schemaFile}>Upload schema.json</button>
              <div style={{color:"#aab2c5"}}>This JSON maps text → SQL tables/columns available to users.</div>
            </div>
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Org</th><th>Access</th><th>Plan</th><th>Active</th><th>Requests</th><th>Features</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.org.org_id}>
                <td>
                  <div style={{fontWeight:600}}>{r.org.name}</div>
                  <div className="kbd">{r.org.base_url}</div>
                  <div className="kbd">code: {r.org.company_code}</div>
                </td>
                <td><span className="kbd">{r.org.access_code}</span></td>
                <td>{r.license?.plan || "-"}</td>
                <td>{r.license?.active ? "✓" : "—"}</td>
                <td>{r.requests_count}</td>
                <td style={{maxWidth:220}}>
                  <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
                    {(r.features || []).map(f => <span key={f} className="kbd">{f}</span>)}
                  </div>
                  <div style={{display:"flex", gap:6, marginTop:8}}>
                    <button className="btn secondary" onClick={()=>toggleFeature(r.org.org_id, "csv_import", true)}>+ CSV</button>
                    <button className="btn secondary" onClick={()=>toggleFeature(r.org.org_id, "project_backup", true)}>+ Backup</button>
                    <button className="btn secondary" onClick={()=>toggleFeature(r.org.org_id, "cert_monitor", true)}>+ Certs</button>
                  </div>
                </td>
                <td style={{display:"flex", gap:8}}>
                  <button className="btn" onClick={()=>activateMonthly(r.org.org_id)}>Activate</button>
                  <button className="btn secondary" onClick={()=>saveOpenAI(r.org.org_id)} title="Save OpenAI key from input at the right">Save Key</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Secrets (per-org)">
        <div className="grid grid-3">
          <div>
            <label className="label">OpenAI API Key</label>
            <input className="input" placeholder="sk-..." value={openaiKey} onChange={(e)=>setOpenaiKey(e.target.value)} />
            <div className="label">Select org row & click <b>Save Key</b>.</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
