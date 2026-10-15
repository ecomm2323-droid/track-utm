import Link from "next/link";
import { MODELS, PERIODS, type Model, type Period } from "@/lib/stats";

export const money = (n: number) =>
  (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function Card({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`glass rounded-xl p-4 ${className}`}>
      {title && <h2 className="text-xs uppercase tracking-wide text-muted mb-3">{title}</h2>}
      {children}
    </section>
  );
}

export function Kpi({ label, value, tone, hint }: { label: string; value: string; tone?: "good" | "bad"; hint?: string }) {
  return (
    <div className="glass lift rounded-xl p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-2xl font-semibold mt-1 tabular-nums ${tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : ""}`}>{value}</div>
      {hint && <div className="text-[11px] text-muted mt-1">{hint}</div>}
    </div>
  );
}

// Period + attribution-model switcher; state lives in the URL so pages stay server-rendered.
// Custom range = p=custom&f=YYYY-MM-DD&t=YYYY-MM-DD (plain GET form, no client JS).
export function Filters({ base, p, m, f, t, extra = "" }: { base: string; p: Period; m: Model; f?: string; t?: string; extra?: string }) {
  const href = (np: Period, nm: Model) => `${base}?p=${np}&m=${nm}${np === "custom" && f ? `&f=${f}&t=${t ?? f}` : ""}${extra}`;
  const chip = (on: boolean) =>
    `px-3 py-1.5 rounded-lg border ${on ? "bg-accent/20 border-accent text-white neon" : "border-line text-muted hover:text-white hover:border-white/25"}`;
  const today = new Date().toLocaleDateString("sv-SE");
  const extras = [...extra.matchAll(/&(\w+)=([^&]*)/g)];
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {(Object.keys(PERIODS) as (keyof typeof PERIODS)[]).map((k) => (
        <Link key={k} href={href(k, m)} className={chip(k === p)}>{PERIODS[k]}</Link>
      ))}
      <details className="relative">
        <summary className={`${chip(p === "custom")} cursor-pointer list-none select-none`}>
          {p === "custom" && f ? `${f} → ${t ?? f}` : "Personalizado"}
        </summary>
        <form method="get" action={base} className="glass rounded-xl p-3 absolute z-20 mt-2 flex flex-col gap-2 w-60 bg-bg/90">
          <input type="hidden" name="p" value="custom" />
          <input type="hidden" name="m" value={m} />
          {extras.map(([, k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <label className="text-xs text-muted">Desde
            <input type="date" name="f" defaultValue={f} max={today} required className="mt-1 w-full rounded-lg bg-black/30 border border-line px-2 py-1.5 text-white" />
          </label>
          <label className="text-xs text-muted">Hasta
            <input type="date" name="t" defaultValue={t ?? f} max={today} required className="mt-1 w-full rounded-lg bg-black/30 border border-line px-2 py-1.5 text-white" />
          </label>
          <button className="rounded-lg bg-accent px-3 py-1.5 text-white font-medium">Aplicar</button>
        </form>
      </details>
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
          <div className="h-1.5 rounded bg-line"><div className="h-1.5 rounded bg-gradient-to-r from-accent to-cyan" style={{ width: `${(r.n / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}
