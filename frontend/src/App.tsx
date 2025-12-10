// frontend/src/App.tsx
import React from "react";
import { useRoutes } from "react-router-dom";
import { routes } from "./router";
import useAuth from "./lib/auth";

const App: React.FC = () => {
  const { loading } = useAuth();
  const element = useRoutes(routes);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading...
      </div>
    );
  }

  return element;
};

export default App;
