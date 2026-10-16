// Auto-sync Meta at startup and every 10 min while the server runs (catches up after the PC was off). Skipped when META_* env vars are missing.
// shortcut: in-process timer, not a real cron; it stops if the server stops. Move to an external scheduler when deployed.
const EVERY_MS = 10 * 60 * 1000;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const g = globalThis as unknown as { __metaSync?: boolean };
  if (g.__metaSync) return;
  g.__metaSync = true;

  const { syncAll, renewToken } = await import("./lib/meta");
  const { dailyBackup } = await import("./lib/backup");
  const { importHistory } = await import("./lib/import-sales");
  const run = () => {
    renewToken().then((r) => r && console.log("[meta] token renovado")).catch((e) => console.error("[meta] renovar token falló:", e.message));
    try {
      const n = importHistory();
      if (n) console.log(`[import] ${n} ventas históricas de Impultienda`);
    } catch (e) {
      console.error("[import] falló:", e instanceof Error ? e.message : e);
    }
    try {
      const f = dailyBackup();
      if (f) console.log("[backup]", f);
    } catch (e) {
      console.error("[backup] falló:", e instanceof Error ? e.message : e);
    }
    return syncAll().then((list) => {
      for (const r of list) {
        if (r.error) console.error(`[meta] ${r.account} falló: ${r.error}`);
        else console.log(`[meta] ${r.account}: ${r.rows} filas`);
      }
    });
  };

  setTimeout(run, 5_000);
  setInterval(run, EVERY_MS);
}
