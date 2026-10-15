import { syncMetaAction } from "@/lib/meta-actions";

export function SyncMeta({ last }: { last: number | null }) {
  return (
    <form action={syncMetaAction} className="flex flex-wrap items-center gap-3 mb-4">
      <button className="px-4 py-2.5 rounded-lg bg-accent text-white">Sincronizar Meta</button>
      <span className="text-xs text-muted">
        {last ? `Última sincronización: ${new Date(last).toLocaleString("es-AR")}` : "Sin sincronizar todavía (trae los últimos 30 días)"}
      </span>
    </form>
  );
}
