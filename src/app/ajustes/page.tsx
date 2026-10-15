import { getProject, q } from "@/lib/db";
import { usdRate } from "@/lib/stats";
import { Card, money, td, th } from "@/components/ui";
import { lastBackups } from "@/lib/backup";
import { tokenDaysLeft } from "@/lib/meta";
import { savePricing } from "./actions";

export const dynamic = "force-dynamic";

const field = "bg-black/30 border border-line rounded-lg px-3 py-2 outline-none focus:border-accent text-white";

export default function Ajustes() {
  const pid = getProject().id;
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
      <form action={savePricing} className="space-y-3">
        <Card title="Valor del dólar">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-muted">1 USD =</label>
            <input name="rate" defaultValue={set ? rate : ""} placeholder="1200" inputMode="decimal" className={`${field} w-32`} />
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
                    <input name={`net_${i}`} defaultValue={p.net ?? ""} placeholder="ej. 38000" inputMode="decimal" className={`${field} w-36`} />
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
        <Card title="Copias de seguridad y conexión">
          <p className="text-muted">
            Copia automática diaria en el servidor (últimas 7): {lastBackups().length ? lastBackups()[0].replace("utmify-", "").replace(".db", "") : "todavía ninguna"}.
            {" "}Meta: {tokenDaysLeft() === undefined ? "sin conexión guardada" : `token vigente, ${tokenDaysLeft()} día(s) (se renueva solo)`}.
          </p>
          <a href="/api/backup" className="inline-block mt-3 px-4 py-2 rounded-lg border border-line hover:border-accent">Descargar copia ahora</a>
          <p className="text-xs text-muted mt-2">Guardá una copia en tu PC de vez en cuando: las automáticas viven en el mismo disco que los datos.</p>
        </Card>
      </div>
    </>
  );
}
