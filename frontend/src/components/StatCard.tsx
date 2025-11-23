// frontend/src/components/StatCard.tsx
import React from "react";

export const StatCard: React.FC<{ label: string; value: number | string }> = ({
  label,
  value
}) => (
  <div className="card p-4">
    <div className="text-xs uppercase text-slate-400">{label}</div>
    <div className="mt-2 text-2xl font-semibold">{value}</div>
  </div>
);
