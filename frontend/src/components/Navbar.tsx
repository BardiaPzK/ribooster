import { useAuth } from "../hooks/useAuth";

export default function Navbar() {
  const { token, isAdmin, displayName, orgName, logout } = useAuth();
  return (
    <>
      <div className="brand">ri<b>booster</b></div>
      <div style={{display:"flex", gap:12, alignItems:"center"}}>
        {token ? (
          <>
            <span className="kbd">{isAdmin ? "admin" : (orgName || "org")}</span>
            <span style={{color:"#aab2c5"}}>{displayName}</span>
            <button className="btn secondary" onClick={logout}>Logout</button>
          </>
        ) : (
          <span style={{color:"#aab2c5"}}>Sign in</span>
        )}
      </div>
    </>
  );
}
