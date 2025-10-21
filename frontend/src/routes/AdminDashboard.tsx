import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthCtx } from "../providers/AuthProvider";

export default function AdminDashboard(){
  const { token, isAdmin } = useContext(AuthCtx);
  if (!token) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/login" replace />;
  return (
    <div className="container">
      <div className="card">
        <h3>Admin Dashboard</h3>
        <p>You are signed in as admin. Next steps: orgs, features, tickets, etc.</p>
      </div>
    </div>
  );
}
