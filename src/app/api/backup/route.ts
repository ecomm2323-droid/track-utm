import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { snapshot } from "@/lib/backup";

export const dynamic = "force-dynamic";

// Behind the login (not in the proxy's public list): downloads a fresh snapshot of the whole database.
export function GET() {
  const tmp = join(tmpdir(), `utmify-${Date.now()}.db`);
  try {
    snapshot(tmp);
    const body = readFileSync(tmp);
    return new Response(body, {
      headers: {
        "content-type": "application/octet-stream",
        "content-disposition": `attachment; filename="utmify-${new Date().toLocaleDateString("sv-SE")}.db"`,
      },
    });
  } finally {
    rmSync(tmp, { force: true });
  }
}
