import Link from "next/link";
import { MODELS, PERIODS, type Model, type Period } from "@/lib/stats";

export const money = (n: number) =>
  (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function Card({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`bg-panel border border-line rounded-lg p-4 ${className}`}>
      {title && <h2 className="text-xs uppercase tracking-wide text-muted mb-3">{title}</h2>}
      {children}
    </section>
  );
}

export function Kpi({ label, value, tone, hint }: { label: string; value: string; tone?: "good" | "bad"; hint?: string }) {
  return (
    <div className="bg-panel border border-line rounded-lg p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-xl font-semibold mt-1 ${tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : ""}`}>{value}</div>
      {hint && <div className="text-[11px] text-muted mt-1">{hint}</div>}
    </div>
  );
}

// Period + attribution-model switcher; state lives in the URL so pages stay server-rendered.
export function Filters({ base, p, m, extra = "" }: { base: string; p: Period; m: Model; extra?: string }) {
  const href = (np: Period, nm: Model) => `${base}?p=${np}&m=${nm}${extra}`;
  const chip = (on: boolean) =>
    `px-3 py-1.5 rounded border ${on ? "bg-accent border-accent text-white" : "border-line text-muted hover:text-white"}`;
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {(Object.keys(PERIODS) as Period[]).map((k) => (
        <Link key={k} href={href(k, m)} className={chip(k === p)}>{PERIODS[k]}</Link>
      ))}
      <span className="mx-2 h-5 w-px bg-line" />
      {(Object.keys(MODELS) as Model[]).map((k) => (
        <Link key={k} href={href(p, k)} className={chip(k === m)}>{MODELS[k]}</Link>
      ))}
    </div>
  );
}

export const th = "text-left text-[11px] uppercase tracking-wide text-muted font-medium px-3 py-2 border-b border-line whitespace-nowrap";
export const td = "px-3 py-2 border-b border-line/60 whitespace-nowrap";

export function Bars({ rows, empty = "Sin datos" }: { rows: { label: string; n: number; extra?: string }[]; empty?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (!rows.length) return <p className="text-muted">{empty}</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex justify-between text-xs mb-1">
            <span>{r.label}</span>
            <span className="text-muted">{r.n}{r.extra ? ` · ${r.extra}` : ""}</span>
          </div>
          <div className="h-1.5 rounded bg-line"><div className="h-1.5 rounded bg-accent" style={{ width: `${(r.n / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}
