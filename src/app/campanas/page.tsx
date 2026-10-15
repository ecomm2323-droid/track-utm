import Link from "next/link";
import { getProject } from "@/lib/db";
import { activeDashboard } from "@/lib/active-dashboard";
import { asModel, asPeriod, byLevel, lastSync, range, type Level } from "@/lib/stats";
import { Card, Filters, money, td, th } from "@/components/ui";
import { SyncMeta } from "@/components/sync-meta";
import { DashboardNotice } from "@/components/dashboard-notice";
import { AutoRefresh } from "@/components/auto-refresh";

export const dynamic = "force-dynamic";

const LEVELS: Record<Level, string> = { campaign: "Campañas", adset: "Conjuntos", ad: "Anuncios" };

// [header, tooltip]; a tooltip adds the ⓘ marker.
const COLUMNS: [string, string?][] = [
  ["Estado"], ["Campaña"], ["Presupuesto", "Presupuesto diario. En campañas sin presupuesto propio, suma el de sus conjuntos activos."],
  ["Últ. actualización", "Última modificación en Meta"], ["Ventas"], ["CPA", "Gasto ÷ ventas aprobadas"], ["Gastos"],
  ["Ingresos", "Ventas aprobadas atribuidas"], ["Ganancia", "Ingresos − gasto (sin costo de producto)"],
  ["ROAS", "Ingresos ÷ gasto"], ["Margen", "Ganancia ÷ ingresos"], ["ROI", "Ganancia ÷ gasto"],
  ["IC", "Inicios de checkout (pixel de Meta)"], ["CPI", "Gasto ÷ inicios de checkout"], ["CPC", "Gasto ÷ clics"],
  ["CTR", "Clics ÷ impresiones"], ["CPM", "Costo por mil impresiones"], ["Impresiones"], ["Clics", "Todos los clics (Meta)"],
  ["Límite de oferta", "Bid cap del conjunto"], ["Gasto mín.", "Gasto mínimo diario del conjunto"], ["Gasto máx.", "Gasto máximo diario del conjunto"],
];

const usd = (n: number | null) => (n == null ? "—" : money(n));
const pct = (n: number | null) => (n == null ? "—" : `${(n * 100).toFixed(2)}%`);
const STATUS = (s: string | null): [string, string] =>
  !s ? ["—", "text-muted"] : s === "ACTIVE" ? ["Activo", "text-good"] : /PAUSED/.test(s) ? ["Pausado", "text-muted"] : [s.toLowerCase().replace(/_/g, " "), "text-yellow-400"];

export default async function Campanas({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; m?: string; l?: string; f?: string; t?: string; c?: string; s?: string }>;
}) {
  const sp = await searchParams;
  const p = asPeriod(sp.p);
  const m = asModel(sp.m);
  const level: Level = sp.l === "adset" || sp.l === "ad" ? sp.l : "campaign";
  const { from, to } = range(p, sp.f, sp.t);
  // Picked campaigns (c) and adsets (s): comma-separated ids in the URL, they carry across the level tabs.
  const ids = (v?: string) => (v ?? "").split(",").filter((x) => /^\d{1,32}$/.test(x)).slice(0, 100);
  const c = ids(sp.c);
  const s = level === "campaign" ? [] : ids(sp.s);
  const date = p === "custom" && sp.f ? `&f=${sp.f}&t=${sp.t ?? sp.f}` : "";
  const url = (l: Level, nc: string[], ns: string[]) =>
    `/campanas?p=${p}&m=${m}&l=${l}${date}${nc.length ? `&c=${nc.join(",")}` : ""}${ns.length ? `&s=${ns.join(",")}` : ""}`;
  const toggle = (id: string) => {
    const on = (level === "campaign" ? c : s).includes(id);
    const flip = (a: string[]) => (on ? a.filter((x) => x !== id) : [...a, id]);
    return level === "campaign" ? url(level, flip(c), []) : url(level, c, flip(s));
  };
  const pid = getProject().id;
  const dash = await activeDashboard();
  const rows = byLevel(pid, from, to, m, level, dash?.ad_account_id ?? "", c, s);

  return (
    <>
      <h1 className="text-lg font-semibold mb-1">Meta</h1>
      <DashboardNotice name={dash?.name} account={dash?.ad_account_id} />
      <AutoRefresh />
      <SyncMeta last={lastSync(pid)} />
      <div className="flex gap-2 mb-3">
        {(Object.keys(LEVELS) as Level[]).map((l) => (
          <Link
            key={l}
            href={url(l, c, l === "ad" ? s : [])}
            className={`px-4 py-2 rounded border ${l === level ? "border-accent text-white bg-panel" : "border-line text-muted"}`}
          >
            {LEVELS[l]}
          </Link>
        ))}
      </div>
      <Filters base="/campanas" p={p} m={m} f={sp.f} t={sp.t} extra={`&l=${level}${c.length ? `&c=${c.join(",")}` : ""}${s.length ? `&s=${s.join(",")}` : ""}`} />
      {(c.length > 0 || s.length > 0) && (
        <p className="text-xs text-muted mb-2">
          Filtrando por {c.length ? `${c.length} campaña(s)` : ""}{c.length && s.length ? " y " : ""}{s.length ? `${s.length} conjunto(s)` : ""} ·{" "}
          <Link href={url(level, [], [])} className="underline text-white">Quitar filtro</Link>
        </p>
      )}
      <Card className="overflow-x-auto p-0">
        <table className="w-full">
          <thead>
            <tr>
              <th className={th} />
              {COLUMNS.map(([h, tip], i) => (
                <th key={h} title={tip} className={`${th} ${i === 1 ? "sticky left-0 bg-[#12141f]" : ""}`}>
                  {h === "Campaña" ? LEVELS[level].slice(0, -1) : h}{tip ? " ⓘ" : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const profit = r.revenue - r.spend;
              const st = STATUS(r.status);
              return (
                <tr key={r.id} className={(level === "campaign" ? c : s).includes(r.id) ? "bg-accent/10" : ""}>
                  <td className={td}>
                    {level !== "ad" && (
                      <Link
                        href={toggle(r.id)}
                        title={level === "campaign" ? "Filtrar conjuntos y anuncios por esta campaña" : "Filtrar anuncios por este conjunto"}
                        className={`inline-block h-4 w-8 rounded-full border ${(level === "campaign" ? c : s).includes(r.id) ? "bg-accent border-accent neon" : "border-line bg-white/5"}`}
                      >
                        <span className={`block h-3 w-3 mt-px rounded-full bg-white transition-transform ${(level === "campaign" ? c : s).includes(r.id) ? "translate-x-[17px]" : "translate-x-px"}`} />
                      </Link>
                    )}
                  </td>
                  <td className={`${td} ${st[1]}`}>{st[0]}</td>
                  <td className={`${td} sticky left-0 bg-[#12141f] max-w-xs`}>
                    <div className="truncate">{r.name}</div>
                    <div className="font-mono text-[10px] text-muted">{r.id}</div>
                  </td>
                  <td className={td}>{usd(r.budget)}</td>
                  <td className={td}>{r.updated ? new Date(r.updated).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "—"}</td>
                  <td className={td}>{r.sales}</td>
                  <td className={td}>{usd(r.sales ? r.spend / r.sales : null)}</td>
                  <td className={td}>{usd(r.spend || null)}</td>
                  <td className={td}>{usd(r.revenue || null)}</td>
                  <td className={`${td} ${profit < 0 ? "text-bad" : profit > 0 ? "text-good" : ""}`}>{r.spend || r.revenue ? money(profit) : "—"}</td>
                  <td className={td}>{r.spend ? `${(r.revenue / r.spend).toFixed(2)}x` : "—"}</td>
                  <td className={td}>{pct(r.revenue ? profit / r.revenue : null)}</td>
                  <td className={td}>{pct(r.spend ? profit / r.spend : null)}</td>
                  <td className={td}>{r.ic}</td>
                  <td className={td}>{usd(r.ic ? r.spend / r.ic : null)}</td>
                  <td className={td}>{usd(r.clicks ? r.spend / r.clicks : null)}</td>
                  <td className={td}>{pct(r.impressions ? r.clicks / r.impressions : null)}</td>
                  <td className={td}>{usd(r.impressions ? (r.spend / r.impressions) * 1000 : null)}</td>
                  <td className={td}>{r.impressions.toLocaleString("en-US")}</td>
                  <td className={td}>{r.clicks.toLocaleString("en-US")}</td>
                  <td className={td}>{usd(r.bid)}</td>
                  <td className={td}>{usd(r.minSpend)}</td>
                  <td className={td}>{usd(r.maxSpend)}</td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr><td className={`${td} text-muted`} colSpan={COLUMNS.length + 1}>Sin datos de esta cuenta en el período. Sincronizá Meta.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-muted mt-3">Gasto, clics, impresiones, estado y presupuesto vienen de Meta; ventas e ingresos, de tus webhooks atribuidos.</p>
    </>
  );
}
