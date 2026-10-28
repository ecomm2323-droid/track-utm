import { getProject, q } from "@/lib/db";
import { dashboards } from "@/lib/dashboards";
import { activeDashboard } from "@/lib/active-dashboard";
import { Card, td, th } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { createDashboard, deleteDashboard, mapStore } from "./actions";

export const metadata = { title: "Dashboards" };
export const dynamic = "force-dynamic";

const field = "bg-bg border border-line rounded px-3 py-2 outline-none focus:border-accent";

export default async function Dashboards() {
  const list = dashboards(getProject().id);
  const active = await activeDashboard();
  const pid = getProject().id;
  const stores = q<{ id: string; name: string; account: string | null }>(
    `select substr(s.key,12) id, s.value name,
            (select m.value from setting m where m.project_id=s.project_id and m.key='store_dash:'||substr(s.key,12)) account
       from setting s where s.project_id=? and s.key like 'store_name:%' order by s.value`,
    pid,
  );

  return (
    <>
      <h1 className="text-lg font-semibold mb-4">Dashboards</h1>
      <div className="space-y-3">
        <Card title="Crear dashboard (una cuenta publicitaria)">
          <form action={createDashboard} className="flex flex-wrap gap-2">
            <input name="name" aria-label="Nombre del dashboard" placeholder="Nombre (ej. Diarios con historia)" className={field} />
            <input name="account" aria-label="ID de la cuenta publicitaria" placeholder="ID de cuenta (act_123…)" className={field} required />
            <button className="px-4 py-2.5 rounded-lg bg-accent text-white">Crear</button>
          </form>
          <p className="text-muted text-xs mt-3">
            Cada dashboard muestra solo el gasto y las ventas atribuidas a esa cuenta. Después de crear, tocá Sincronizar Meta en Resumen.
          </p>
        </Card>

        <Card title="Tiendas de Impultienda → dashboard">
          {stores.map((s) => (
            <form key={s.id} action={mapStore} className="flex flex-wrap items-center gap-2 py-1">
              <input type="hidden" name="store" value={s.id} />
              <span className="min-w-48">{s.name}</span>
              <select name="account" defaultValue={s.account ?? ""} aria-label={`Dashboard de ${s.name}`} className={field}>
                <option value="">Sin asignar</option>
                {list.map((d) => <option key={d.id} value={d.ad_account_id}>{d.name}</option>)}
              </select>
              <button className="px-3 py-2 rounded-lg border border-line hover:border-accent">Guardar</button>
              <span role="status" className={s.account ? "text-good" : "text-muted"}>
                {s.account ? `✓ Guardado: ${list.find((d) => d.ad_account_id === s.account)?.name ?? s.account}` : "Sin asignar"}
              </span>
            </form>
          ))}
          {!stores.length && <p className="text-muted">Todavía no llegó ningún aviso con tienda. En Impultienda, tocá «Probar» en el webhook y recargá.</p>}
          <p className="text-muted text-xs mt-3">
            Las ventas de esa tienda que lleguen sin campaña (sin UTMs ni pixel) se cuentan en el dashboard elegido. Las que traen campaña siguen yendo a la cuenta de esa campaña. Solo vale para ventas nuevas.
          </p>
        </Card>

        <Card className="overflow-x-auto p-0">
          <table className="w-full">
            <thead>
              <tr>{["Nombre", "Cuenta", "Estado", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id}>
                  <td className={td}>{d.name}</td>
                  <td className={`${td} font-mono text-muted`}>{d.ad_account_id}</td>
                  <td className={td}>
                    {d.id === active?.id ? <span className="text-good">Activo</span> : (
                      <a href={`/dashboards/activate?id=${d.id}`} className="underline text-muted hover:text-white">Activar</a>
                    )}
                  </td>
                  <td className={td}>
                    <form action={deleteDashboard}>
                      <input type="hidden" name="id" value={d.id} />
                      <ConfirmButton message="¿Eliminar este dashboard?" className="text-bad text-xs underline py-2">Eliminar</ConfirmButton>
                    </form>
                  </td>
                </tr>
              ))}
              {!list.length && <tr><td className={`${td} text-muted`} colSpan={4}>Todavía no hay dashboards.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
