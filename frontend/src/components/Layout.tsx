// frontend/src/components/Layout.tsx
import React from "react";

export const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-10">{children}</div>
    </div>
  );
};
