import { getProject } from "@/lib/db";
import { activeDashboard } from "@/lib/active-dashboard";
import { asModel, asPeriod, lastSync, overview, range } from "@/lib/stats";
import { Bars, Card, Filters, Kpi, money } from "@/components/ui";
import { SyncMeta } from "@/components/sync-meta";
import { DashboardNotice } from "@/components/dashboard-notice";
import { AutoRefresh } from "@/components/auto-refresh";

export const dynamic = "force-dynamic";

export default async function Resumen({ searchParams }: { searchParams: Promise<{ p?: string; m?: string }> }) {
  const sp = await searchParams;
  const p = asPeriod(sp.p);
  const m = asModel(sp.m);
  const { from, to } = range(p);
  const pid = getProject().id;
  const dash = await activeDashboard();
  const { k, byMethod, bySource, byProduct, spend } = overview(pid, from, to, m, dash?.ad_account_id ?? "");
  const settled = k.approved + k.rejected;
  const noSpend = spend.spend ? undefined : "Sincronizá Meta para ver gasto";
  const profit = k.rev - spend.spend;

  return (
    <>
      <h1 className="text-lg font-semibold mb-1">Resumen</h1>
      <DashboardNotice name={dash?.name} account={dash?.ad_account_id} />
      <AutoRefresh />
      <SyncMeta last={lastSync(pid)} />
      <Filters base="/" p={p} m={m} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <Kpi label="Facturación neta" value={money(k.rev)} />
        <Kpi label="Ventas aprobadas" value={String(k.approved)} />
        <Kpi label="Ticket medio" value={k.approved ? money(k.rev / k.approved) : "—"} />
        <Kpi label="Tasa de aprobación" value={settled ? `${((k.approved / settled) * 100).toFixed(1)}%` : "—"} />
        <Kpi label="Ventas pendientes" value={String(k.pending)} hint={money(k.pending_value)} />
        <Kpi label="Reembolsos" value={String(k.refunded)} hint={money(k.refunded_value)} />
        <Kpi label="Contracargos" value={String(k.chargebacks)} />
        <Kpi label="Rechazadas" value={String(k.rejected)} />
        <Kpi label="Gasto en anuncios" value={spend.spend ? money(spend.spend) : "—"} hint={noSpend} />
        <Kpi label="ROAS" value={spend.spend ? `${(k.rev / spend.spend).toFixed(2)}x` : "—"} hint={noSpend} />
        <Kpi label="Ganancia" value={spend.spend ? money(profit) : "—"} tone={profit < 0 ? "bad" : "good"} hint={spend.spend ? "Ventas − gasto (sin costo de producto)" : noSpend} />
        <Kpi label="ROI" value={spend.spend ? `${((profit / spend.spend) * 100).toFixed(1)}%` : "—"} hint={noSpend} />
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <Card title="Ventas por fuente">
          <Bars rows={bySource.map((r) => ({ label: r.label, n: r.n, extra: money(r.rev) }))} />
        </Card>
        <Card title="Ventas por método de pago">
          <Bars rows={byMethod.filter((r) => r.n).map((r) => ({ label: r.label, n: r.n }))} />
        </Card>
        <Card title="Ventas por producto">
          <Bars rows={byProduct.map((r) => ({ label: r.label, n: r.n, extra: money(r.rev) }))} />
        </Card>
      </div>
    </>
  );
}
