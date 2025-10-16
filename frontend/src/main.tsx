import React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./styles.css";
import App from "./App";
import { AuthProvider } from "./providers/AuthProvider";
import LoginPage from "./routes/LoginPage";
import AdminDashboard from "./routes/AdminDashboard";
import UserDashboard from "./routes/UserDashboard";
import NotFound from "./routes/NotFound";

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <AuthProvider>
        <App />
      </AuthProvider>
    ),
    children: [
      { index: true, element: <LoginPage /> }, // default to login
      { path: "login", element: <LoginPage /> },
      { path: "admin/*", element: <AdminDashboard /> },
      { path: "app/*", element: <UserDashboard /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
