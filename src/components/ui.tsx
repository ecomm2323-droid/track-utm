import Link from "next/link";
import { BASIS, MODELS, PERIODS, type Basis, type Day, type Model, type Period } from "@/lib/stats";
import { ymd } from "@/lib/meta";

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
      {hint && <div className="text-xs text-muted mt-1">{hint}</div>}
    </div>
  );
}

// Period + attribution-model + revenue-basis switcher; state lives in the URL so pages stay server-rendered.
// Custom range = p=custom&f=YYYY-MM-DD&t=YYYY-MM-DD (plain GET form, no client JS). Phones get the same controls folded into one "Filtros" panel.
export function Filters({ base, p, m, v, f, t, extra = "" }: { base: string; p: Period; m: Model; v: Basis; f?: string; t?: string; extra?: string }) {
  const href = (np: Period, nm: Model, nv: Basis = v) => `${base}?p=${np}&m=${nm}&v=${nv}${np === "custom" && f ? `&f=${f}&t=${t ?? f}` : ""}${extra}`;
  const chip = (on: boolean) =>
    `inline-flex items-center min-h-11 md:min-h-0 px-3 py-1.5 rounded-lg border ${on ? "bg-accent/20 border-accent text-white neon" : "border-line text-muted hover:text-white hover:border-white/25"}`;
  const now = Date.now();
  const d = new Date();
  const monday = now - ((d.getDay() + 6) % 7) * 864e5;
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const prevStart = new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime();
  const quick: [string, number, number][] = [
    ["Esta semana", monday, now],
    ["Este mes", monthStart, now],
    ["Mes pasado", prevStart, monthStart - 864e5],
  ];
  const today = ymd(now);
  const extras = [...extra.matchAll(/&(\w+)=([^&]*)/g)];
  const field = "mt-1 w-full rounded-lg bg-black/30 border border-line px-2 py-2 text-white";
  const body = (
    <>
      {(Object.keys(PERIODS) as (keyof typeof PERIODS)[]).map((k) => (
        <Link key={k} href={href(k, m)} className={chip(k === p)}>{PERIODS[k]}</Link>
      ))}
      <details className="relative">
        <summary className={`${chip(p === "custom")} cursor-pointer list-none select-none`}>
          {p === "custom" && f ? `${f} → ${t ?? f}` : "Personalizado"}
        </summary>
        <div className="glass rounded-xl p-3 absolute z-20 mt-2 flex flex-col gap-2 w-64 bg-bg/95">
          <div className="flex flex-wrap gap-1.5">
            {quick.map(([label, a, b]) => (
              <Link key={label} href={`${base}?p=custom&m=${m}&v=${v}&f=${ymd(a)}&t=${ymd(b)}${extra}`} className="rounded-lg border border-line px-2.5 py-2 text-xs text-muted hover:text-white hover:border-accent">
                {label}
              </Link>
            ))}
          </div>
          <form method="get" action={base} className="flex flex-col gap-2">
            <input type="hidden" name="p" value="custom" />
            <input type="hidden" name="m" value={m} />
            <input type="hidden" name="v" value={v} />
            {extras.map(([, k, val]) => <input key={k} type="hidden" name={k} value={val} />)}
            <label className="text-xs text-muted">Desde
              <input type="date" name="f" defaultValue={f} max={today} required className={field} />
            </label>
            <label className="text-xs text-muted">Hasta
              <input type="date" name="t" defaultValue={t ?? f} max={today} required className={field} />
            </label>
            <button className="rounded-lg bg-accent px-3 py-2.5 text-white font-medium">Aplicar</button>
          </form>
        </div>
      </details>
      <span aria-hidden className="mx-2 h-5 w-px bg-line hidden md:block" />
      {(Object.keys(MODELS) as Model[]).map((k) => (
        <Link key={k} href={href(p, k)} className={chip(k === m)}>{MODELS[k]}</Link>
      ))}
      <span aria-hidden className="mx-2 h-5 w-px bg-line hidden md:block" />
      {(Object.keys(BASIS) as Basis[]).map((k) => (
        <Link key={k} href={href(p, m, k)} className={chip(k === v)}>Facturación {BASIS[k].toLowerCase()}</Link>
      ))}
    </>
  );
  const label = p === "custom" ? "Personalizado" : PERIODS[p];
  return (
    <>
      <div className="hidden md:flex flex-wrap items-center gap-2 mb-4">{body}</div>
      <details className="md:hidden mb-4 glass rounded-xl">
        <summary className="px-3 min-h-11 flex items-center cursor-pointer list-none text-muted">
          Filtros · {label} · {MODELS[m]} · {BASIS[v]} ▾
        </summary>
        <div className="flex flex-wrap items-center gap-2 p-3 pt-1">{body}</div>
      </details>
    </>
  );
}

// Spend (bars) vs revenue (line) per day. Pure SVG; the table below it is for screen readers.
export function DailyChart({ rows }: { rows: Day[] }) {
  const W = 640, H = 170, P = 24;
  const max = Math.max(1, ...rows.flatMap((r) => [r.spend, r.rev]));
  const slot = (W - P * 2) / rows.length;
  const y = (n: number) => H - P - (n / max) * (H - P * 2);
  const line = rows.map((r, i) => `${P + slot * i + slot / 2},${y(r.rev)}`).join(" ");
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Gasto y facturación por día" className="w-full h-auto">
        <line x1={P} x2={W - P} y1={H - P} y2={H - P} stroke="rgba(255,255,255,.15)" />
        {rows.map((r, i) => (
          <g key={r.date}>
            <title>{`${r.date}: gasto ${money(r.spend)}, facturación ${money(r.rev)}`}</title>
            <rect x={P + slot * i + slot * 0.15} y={y(r.spend)} width={slot * 0.7} height={H - P - y(r.spend)} rx="2" fill="#8b7cff" opacity=".75" />
          </g>
        ))}
        <polyline points={line} fill="none" stroke="#3dffa0" strokeWidth="2" strokeLinejoin="round" />
        {rows.map((r, i) => <circle key={r.date} cx={P + slot * i + slot / 2} cy={y(r.rev)} r="3" fill="#3dffa0" />)}
        <text x={P} y={H - 6} fill="#9aa2c0" fontSize="11">{rows[0].date}</text>
        <text x={W - P} y={H - 6} fill="#9aa2c0" fontSize="11" textAnchor="end">{rows[rows.length - 1].date}</text>
        <text x={P} y={12} fill="#9aa2c0" fontSize="11">{money(max)}</text>
      </svg>
      <figcaption className="flex gap-4 text-xs text-muted mt-1">
        <span><span aria-hidden className="inline-block h-2 w-3 rounded-sm bg-accent mr-1" />Gasto (barras)</span>
        <span><span aria-hidden className="inline-block h-0.5 w-3 bg-good mr-1 align-middle" />Facturación (línea)</span>
      </figcaption>
      <table className="sr-only">
        <caption>Gasto y facturación por día</caption>
        <thead><tr><th>Día</th><th>Gasto</th><th>Facturación</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.date}><td>{r.date}</td><td>{money(r.spend)}</td><td>{money(r.rev)}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

export const th = "text-left text-xs uppercase tracking-wide text-muted font-medium px-3 py-2 border-b border-line whitespace-nowrap";
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
