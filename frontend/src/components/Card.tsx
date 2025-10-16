import { PropsWithChildren } from "react";
export default function Card({ title, children, right }: PropsWithChildren<{title: string; right?: React.ReactNode;}>) {
  return (
    <div className="card">
      <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10}}>
        <h3 style={{margin:0}}>{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}
