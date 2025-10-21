import { Outlet, Link, useLocation, Navigate } from "react-router-dom";
import { useContext } from "react";
import { AuthCtx } from "./providers/AuthProvider";

export default function App(){
  const { token, isAdmin, displayName, logout } = useContext(AuthCtx);
  const loc = useLocation();
  if (token && loc.pathname === "/") return <Navigate to="/admin" replace />;

  return (
    <>
      <div className="nav">
        <div className="nav-inner">
          <div className="brand">ri<b>booster</b></div>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            {token ? (<>
              <span className="kbd">{isAdmin?"admin":"user"}</span>
              <span style={{color:"#aab2c5"}}>{displayName}</span>
              <button className="btn secondary" onClick={logout}>Logout</button>
            </>) : (<Link to="/login" className="btn secondary">Sign in</Link>)}
          </div>
        </div>
      </div>
      <Outlet/>
    </>
  );
}
