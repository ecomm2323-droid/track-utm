import { syncMetaAction } from "@/lib/meta-actions";

export function SyncMeta({ last }: { last: number | null }) {
  return (
    <form action={syncMetaAction} className="flex flex-wrap items-center gap-3 mb-4">
      <button className="px-4 py-2 rounded bg-accent text-white">Sincronizar Meta</button>
      <span className="text-xs text-muted">
        {last ? `Última sincronización: ${new Date(last).toLocaleString("es-AR")}` : "Sin sincronizar todavía (trae los últimos 30 días)"}
      </span>
      <a href="/api/meta/connect" className="text-xs text-muted underline hover:text-white">Conectar / reconectar con Meta</a>
    </form>
  );
}
