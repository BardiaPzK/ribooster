// frontend/src/components/StatCard.tsx
import React from "react";

type Props = {
  label: string;
  value: React.ReactNode;
  sub?: string;
};

const StatCard: React.FC<Props> = ({ label, value, sub }) => {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
      <div className="text-xs uppercase tracking-widest text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-slate-100">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
};

export default StatCard;
