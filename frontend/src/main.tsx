import React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./styles.css";
import App from "./App";
import { AuthProvider } from "./providers/AuthProvider";
import LoginPage from "./routes/LoginPage";
import AdminDashboard from "./routes/AdminDashboard";
import NotFound from "./routes/NotFound";

const router = createBrowserRouter([
  {
    path: "/",
    element: (<AuthProvider><App/></AuthProvider>),
    children: [
      { index:true, element:<LoginPage/> },
      { path:"login", element:<LoginPage/> },
      { path:"admin", element:<AdminDashboard/> },
      { path:"*", element:<NotFound/> },
    ]
  }
]);

createRoot(document.getElementById("root")!).render(<RouterProvider router={router} />);
