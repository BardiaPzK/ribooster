import { Outlet, useLocation, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import { useAuth } from "./hooks/useAuth";

/**
 * App frame:
 * - Wraps children with a single Navbar
 * - Avoids double rendering of <Login /> (we route to it; we never render it inside the provider)
 */
export default function App() {
  const { token } = useAuth();
  const loc = useLocation();

  // If token exists and user is on "/", forward to the proper home
  if (token && loc.pathname === "/") {
    return <Navigate to="/app" replace />;
  }
  return (
    <>
      <div className="nav">
        <div className="nav-inner">
          <Navbar />
        </div>
      </div>
      <Outlet />
    </>
  );
}
