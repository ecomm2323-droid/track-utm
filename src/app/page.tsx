import Link from "next/link";
import { getProject } from "@/lib/db";
import { activeDashboard } from "@/lib/active-dashboard";
import { asBasis, asModel, asPeriod, daily, lastSale, lastSync, overview, range, usdSet } from "@/lib/stats";
import { Bars, Card, DailyChart, Filters, Kpi, money } from "@/components/ui";
import { SyncMeta } from "@/components/sync-meta";
import { DashboardNotice } from "@/components/dashboard-notice";
import { AutoRefresh } from "@/components/auto-refresh";

export const metadata = { title: "Resumen" };
export const dynamic = "force-dynamic";

export default async function Resumen({ searchParams }: { searchParams: Promise<{ p?: string; m?: string; v?: string; f?: string; t?: string }> }) {
  const sp = await searchParams;
  const p = asPeriod(sp.p);
  const m = asModel(sp.m);
  const v = asBasis(sp.v);
  const { from, to } = range(p, sp.f, sp.t);
  const pid = getProject().id;
  const dash = await activeDashboard();
  const acc = dash?.ad_account_id ?? "";
  const { k, byMethod, bySource, byProduct, spend } = overview(pid, from, to, m, acc);
  const settled = k.approved + k.rejected;
  const noSpend = spend.spend ? undefined : "Sincronizá Meta para ver gasto";
  const rev = v === "neta" ? k.net : k.rev; // revenue on the chosen basis; profit/ROAS/ROI follow it
  const profit = rev - spend.spend;
  const series = daily(pid, from, to, m, acc, v);
  const last = k.total ? null : lastSale(pid, acc, m);

  return (
    <>
      <h1 className="text-lg font-semibold mb-1">Resumen</h1>
      <DashboardNotice name={dash?.name} account={dash?.ad_account_id} />
      <AutoRefresh />
      {!usdSet(pid) && (
        <p className="mb-3 rounded-lg border border-warn/50 bg-warn/10 px-3 py-2 text-warn">
          Falta cargar el valor del dólar: hoy los pesos se muestran como dólares.{" "}
          <Link href="/ajustes" className="underline">Cargarlo en Ajustes</Link>
        </p>
      )}
      <SyncMeta last={lastSync(pid)} />
      <Filters base="/" p={p} m={m} v={v} f={sp.f} t={sp.t} />
      {!k.total && (
        <p className="mb-3 text-muted">
          Sin ventas en este período.{" "}
          {last ? `Última venta aprobada: ${new Date(last).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}.` : "Todavía no entró ninguna venta atribuida a esta cuenta."}
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <Kpi label={`Facturación ${v} (USD)`} value={money(rev)} hint={v === "neta" ? `Bruta: ${money(k.rev)}` : `Neta tras impuestos: ${money(k.net)}`} />
        <Kpi label="Ventas aprobadas" value={String(k.approved)} />
        <Kpi label="Ticket medio" value={k.approved ? money(rev / k.approved) : "—"} />
        <Kpi label="Tasa de aprobación" value={settled ? `${((k.approved / settled) * 100).toFixed(1)}%` : "—"} />
        <Kpi label="Gasto en anuncios" value={spend.spend ? money(spend.spend) : "—"} hint={noSpend} />
        <Kpi label="ROAS" value={spend.spend ? `${(rev / spend.spend).toFixed(2)}x` : "—"} hint={noSpend} />
        <Kpi label="Ganancia" value={spend.spend ? money(profit) : "—"} tone={profit < 0 ? "bad" : "good"} hint={spend.spend ? `Facturación ${v} − gasto (USD)` : noSpend} />
        <Kpi label="ROI" value={spend.spend ? `${((profit / spend.spend) * 100).toFixed(1)}%` : "—"} hint={noSpend} />
        <div className="glass rounded-xl px-4 py-3 col-span-2 lg:col-span-4 flex flex-wrap gap-x-6 gap-y-1 text-muted">
          <span>Pendientes: <b className="text-white">{k.pending}</b> ({money(k.pending_value)})</span>
          <span>Reembolsos: <b className="text-white">{k.refunded}</b> ({money(k.refunded_value)})</span>
          <span>Contracargos: <b className="text-white">{k.chargebacks}</b></span>
          <span>Rechazadas: <b className="text-white">{k.rejected}</b></span>
        </div>
      </div>

      {series.length > 1 && (
        <div className="mb-3">
          <Card title={`Gasto y facturación ${v} por día (USD)`}>
            <DailyChart rows={series} />
          </Card>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-3">
        <Card title="Ventas por fuente">
          <Bars rows={bySource.map((r) => ({ label: r.label, n: r.n, extra: money(v === "neta" ? r.net : r.rev) }))} />
        </Card>
        <Card title="Ventas por método de pago">
          <Bars rows={byMethod.filter((r) => r.n).map((r) => ({ label: r.label, n: r.n }))} />
        </Card>
        <Card title="Ventas por producto">
          <Bars rows={byProduct.map((r) => ({ label: r.label, n: r.n, extra: money(v === "neta" ? r.net : r.rev) }))} />
        </Card>
      </div>
    </>
  );
}
