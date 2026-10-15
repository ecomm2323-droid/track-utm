import { getProject } from "@/lib/db";
import { activeDashboard } from "@/lib/active-dashboard";
import { asModel, asPeriod, range, sales } from "@/lib/stats";
import { Card, Filters, money, td, th } from "@/components/ui";
import { DashboardNotice } from "@/components/dashboard-notice";
import { AutoRefresh } from "@/components/auto-refresh";

export const dynamic = "force-dynamic";

const TONE: Record<string, string> = {
  approved: "text-good",
  pending: "text-yellow-400",
  refunded: "text-bad",
  chargeback: "text-bad",
  rejected: "text-muted",
};

export default async function Ventas({ searchParams }: { searchParams: Promise<{ p?: string; m?: string }> }) {
  const sp = await searchParams;
  const p = asPeriod(sp.p);
  const m = asModel(sp.m);
  const { from, to } = range(p);
  const dash = await activeDashboard();
  const rows = sales(getProject().id, from, to, m, dash?.ad_account_id ?? "");

  return (
    <>
      <h1 className="text-lg font-semibold mb-1">Ventas</h1>
      <DashboardNotice name={dash?.name} account={dash?.ad_account_id} />
      <AutoRefresh />
      <Filters base="/ventas" p={p} m={m} />
      <Card className="overflow-x-auto p-0">
        <table className="w-full">
          <thead>
            <tr>
              {["Fecha", "Pedido", "Estado", "Valor", "Plataforma", "Producto", "Pago", "Fuente", "Campaña", "Anuncio", "Confianza"].map((h) => (
                <th key={h} className={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={td}>{new Date(r.ts).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}</td>
                <td className={`${td} font-mono text-xs`}>{r.order_id.slice(0, 18)}</td>
                <td className={`${td} ${TONE[r.status] ?? ""}`}>{r.status}</td>
                <td className={td}>{money(r.value)}</td>
                <td className={td}>{r.platform ?? "—"}</td>
                <td className={td}>{r.product ?? "—"}</td>
                <td className={td}>{r.payment_method ?? "—"}</td>
                <td className={td}>{r.channel ?? "—"}</td>
                <td className={td}>{r.campaign ?? "—"}</td>
                <td className={td}>{r.ad_name ?? r.ad_id ?? "—"}</td>
                <td className={`${td} text-muted`}>{r.confidence ?? "—"}</td>
              </tr>
            ))}
            {!rows.length && <tr><td className={`${td} text-muted`} colSpan={11}>Sin ventas de esta cuenta en el período.</td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  );
}
