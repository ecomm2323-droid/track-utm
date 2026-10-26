import { getProject, q, q1 } from "@/lib/db";
import { usdRate } from "@/lib/stats";
import { Card, money, td, th } from "@/components/ui";
import { lastBackups } from "@/lib/backup";
import { tokenDaysLeft, checkAccount } from "@/lib/meta";
import { dashboards } from "@/lib/dashboards";
import { headers } from "next/headers";
import { CopyButton } from "@/components/copy-button";
import { mcpKey } from "@/lib/mcp-key";
import { savePricing } from "./actions";

export const metadata = { title: "Ajustes" };
export const dynamic = "force-dynamic";

const field = "bg-black/30 border border-line rounded-lg px-3 py-2 outline-none focus:border-accent text-white";

export default async function Ajustes({ searchParams }: { searchParams: Promise<{ ok?: string; check?: string }> }) {
  const sp = await searchParams;
  const saved = sp.ok === "1";
  const pid = getProject().id;
  const checks: { ok: boolean; text: string }[] = [];
  if (sp.check === "1") {
    for (const d of dashboards(pid)) {
      try {
        checks.push({ ok: true, text: `Meta · ${d.name}: conectado (cuenta «${await checkAccount(d.ad_account_id, pid)}»).` });
      } catch (e) {
        checks.push({ ok: false, text: `Meta · ${d.name}: ${(e as Error).message}` });
      }
    }
    if (!checks.length) checks.push({ ok: false, text: "Meta: no hay dashboards creados." });
    const hook = q1<{ n: number }>("select count(*) n from webhook where project_id=? and platform='impultienda'", pid);
    const last = q1<{ ts: number; ok: number; note: string }>(
      "select ts, ok, note from webhook_log where project_id=? and platform='impultienda' order by id desc limit 1", pid,
    );
    const when = last && new Date(last.ts).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
    checks.push(
      !hook?.n ? { ok: false, text: "Impultienda: no creaste el webhook (Integraciones → Webhooks)." }
      : !last ? { ok: false, text: "Impultienda: webhook creado, pero todavía no llegó ninguna venta." }
      : last.ok ? { ok: true, text: `Impultienda: último aviso recibido OK el ${when}.` }
      : { ok: false, text: `Impultienda: el último aviso (${when}) dio error: ${last.note}` },
    );
  }
  const h = await headers();
  const base = process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
  const mcpUrl = `${base}/api/mcp?key=${mcpKey()}`;
  const mcpCmd = `claude mcp add --transport http attribution "${mcpUrl}"`;
  const rate = usdRate(pid);
  const set = q("select 1 from setting where project_id=? and key='usd_rate'", pid).length > 0;
  const products = q<{ product: string; n: number; avg: number; net: number | null }>(
    `select c.product, count(*) n, avg(c.value) avg,
            (select net_ars from product_net n where n.project_id=c.project_id and n.product=c.product) net
       from conversion c where c.project_id=? and c.product is not null group by c.product order by n desc`,
    pid,
  );

  return (
    <>
      <h1 className="text-lg font-semibold mb-4">Ajustes de precios</h1>
      {saved && <p role="status" className="mb-3 rounded-lg border border-good/40 bg-good/10 px-3 py-2 text-good">Guardado.</p>}
      <form action={savePricing} className="space-y-3">
        <Card title="Valor del dólar">
          <div className="flex items-center gap-3 flex-wrap">
            <label htmlFor="rate" className="text-muted">1 USD =</label>
            <input id="rate" name="rate" defaultValue={set ? rate : ""} placeholder="1200" inputMode="decimal" className={`${field} w-32`} />
            <span className="text-muted">ARS</span>
          </div>
          <p className="text-xs text-muted mt-2">
            Las ventas de Impultienda llegan en pesos y el gasto de Meta en dólares. Con este valor todo el panel se muestra en USD.
            {!set && " Sin cargarlo, los pesos se muestran como si fueran dólares."}
          </p>
        </Card>

        <Card className="overflow-x-auto p-0">
          <table className="w-full">
            <thead>
              <tr>{["Producto", "Ventas", "Precio de venta (ARS)", "Te queda tras impuestos (ARS)", "Neto en USD"].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={p.product}>
                  <td className={td}>
                    <input type="hidden" name={`product_${i}`} value={p.product} />
                    {p.product}
                  </td>
                  <td className={td}>{p.n}</td>
                  <td className={td}>{money(p.avg)}</td>
                  <td className={td}>
                    <input aria-label={`Neto en ARS de ${p.product}`} name={`net_${i}`} defaultValue={p.net ?? ""} placeholder="ej. 38000" inputMode="decimal" className={`${field} w-36`} />
                  </td>
                  <td className={`${td} text-good`}>{p.net ? money(p.net / rate) : "—"}</td>
                </tr>
              ))}
              {!products.length && <tr><td className={`${td} text-muted`} colSpan={5}>Todavía no hay ventas con producto. Aparecerán acá cuando entre la primera.</td></tr>}
            </tbody>
          </table>
        </Card>
        <p className="text-xs text-muted">
          Ganancia neta = (lo que te queda por producto ÷ dólar) − gasto en anuncios. Producto sin monto cargado: se usa el precio de venta completo.
        </p>
        <button className="px-4 py-2 rounded-lg bg-accent text-white font-medium neon">Guardar</button>
      </form>

      <div className="mt-6">
        <Card title="Probar conexiones">
          <p className="text-muted">Revisa que Meta responda con tu token y que Impultienda esté mandando ventas.</p>
          <a href="/ajustes?check=1" className="inline-block mt-3 px-4 py-2.5 rounded-lg border border-line hover:border-accent">Probar conexiones</a>
          {checks.length > 0 && (
            <ul role="status" className="mt-3 space-y-1">
              {checks.map((c, i) => (
                <li key={i} className={c.ok ? "text-good" : "text-bad"}>{c.ok ? "✓" : "✕"} {c.text}</li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted mt-2">Impultienda no se puede consultar directo: se confía en el último aviso (webhook) recibido.</p>
        </Card>
      </div>

      <div className="mt-6">
        <Card title="Conectar con Claude Code (MCP, solo lectura)">
          <p className="text-muted">
            Te deja preguntarle a Claude Code por tus campañas, ventas y ROAS. Solo lee: no puede cambiar nada. Pegá esto en una terminal:
          </p>
          <div className="flex gap-2 items-start my-2">
            <pre className="flex-1 bg-bg border border-line rounded p-3 font-mono text-xs whitespace-pre-wrap break-all">{mcpCmd}</pre>
            <CopyButton text={mcpCmd} />
          </div>
          <p className="text-xs text-muted">
            El link lleva tu clave: quien lo tenga puede leer tus números. No lo compartas. Para que funcione con Claude Code en tu PC, esta página tiene que estar abierta desde la dirección de Railway (no localhost).
          </p>
        </Card>
      </div>

      <div className="mt-6">
        <Card title="Copias de seguridad y conexión">
          <p className="text-muted">
            Copia automática diaria en el servidor (últimas 7): {lastBackups().length ? lastBackups()[0].replace("utmify-", "").replace(".db", "") : "todavía ninguna"}.
            {" "}Meta: {tokenDaysLeft() === undefined ? "sin conexión guardada" : `token vigente, ${tokenDaysLeft()} día(s) (se renueva solo)`}.
          </p>
          <a href="/api/meta/connect" className="inline-block mt-3 mr-2 px-4 py-2.5 rounded-lg border border-line hover:border-accent">Conectar / reconectar con Meta</a>
          <a href="/api/backup" className="inline-block mt-3 px-4 py-2.5 rounded-lg border border-line hover:border-accent">Descargar copia ahora</a>
          <p className="text-xs text-muted mt-2">Guardá una copia en tu PC de vez en cuando: las automáticas viven en el mismo disco que los datos.</p>
        </Card>
      </div>
    </>
  );
}
