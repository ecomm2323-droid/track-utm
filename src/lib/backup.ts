import { mkdirSync, readdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { db } from "./db";

const dir = () => join(process.env.DATA_DIR ?? join(process.cwd(), "data"), "backups");
const KEEP = 7;

// Consistent snapshot of the live database (safe while it is being written; a plain file copy is not).
export function snapshot(path: string) {
  db().exec(`VACUUM INTO '${path.replace(/'/g, "''")}'`);
}

// One snapshot per day in DATA_DIR/backups, last 7 kept.
// shortcut: same volume as the data, so it covers corruption and bad deletes but not losing the volume; /api/backup downloads a copy off-site.
export function dailyBackup(): string | undefined {
  mkdirSync(dir(), { recursive: true });
  const file = join(dir(), `utmify-${new Date().toLocaleDateString("sv-SE")}.db`);
  if (existsSync(file)) return;
  snapshot(file);
  for (const f of readdirSync(dir()).filter((n) => /^utmify-.*\.db$/.test(n)).sort().slice(0, -KEEP)) rmSync(join(dir(), f));
  return file;
}

export const lastBackups = () => (existsSync(dir()) ? readdirSync(dir()).filter((n) => n.endsWith(".db")).sort().reverse() : []);
