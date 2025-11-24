// frontend/src/App.tsx
import React from "react";
import { BrowserRouter } from "react-router-dom";
import AppRouter from "./router";

const App: React.FC = () => {
  return (
    <BrowserRouter basename="/app">
      <AppRouter />
    </BrowserRouter>
  );
};

export default App;
