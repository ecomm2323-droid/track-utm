import { getProject } from "@/lib/db";
import { dashboards } from "@/lib/dashboards";
import { activeDashboard } from "@/lib/active-dashboard";
import { Card, td, th } from "@/components/ui";
import { createDashboard, deleteDashboard } from "./actions";

export const dynamic = "force-dynamic";

const field = "bg-bg border border-line rounded px-3 py-2 outline-none focus:border-accent";

export default async function Dashboards() {
  const list = dashboards(getProject().id);
  const active = await activeDashboard();

  return (
    <>
      <h1 className="text-lg font-semibold mb-4">Dashboards</h1>
      <div className="space-y-3">
        <Card title="Crear dashboard (una cuenta publicitaria)">
          <form action={createDashboard} className="flex flex-wrap gap-2">
            <input name="name" placeholder="Nombre (ej. Diarios con historia)" className={field} />
            <input name="account" placeholder="ID de cuenta (act_123…)" className={field} required />
            <button className="px-4 py-2 rounded bg-accent text-white">Crear</button>
          </form>
          <p className="text-muted text-xs mt-3">
            Cada dashboard muestra solo el gasto y las ventas atribuidas a esa cuenta. Después de crear, tocá Sincronizar Meta en Resumen.
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
                      <button className="text-bad text-xs underline">Eliminar</button>
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
