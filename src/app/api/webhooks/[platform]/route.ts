import { getProject, q1, run } from "@/lib/db";
import { recordConversion } from "@/lib/conversions";
import { clip } from "@/lib/http";
import { normalize, PLATFORMS, skipReason, type Platform } from "@/lib/webhooks";

// POST /api/webhooks/<platform>?token=<webhook token>. Token is per webhook (Integraciones > Webhooks).
export async function POST(req: Request, ctx: { params: Promise<{ platform: string }> }) {
  const { platform } = await ctx.params;
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const hook = q1<{ id: number; project_id: number }>("select id, project_id from webhook where token=?", token);
  if (!hook) return Response.json({ error: "invalid_token" }, { status: 401 });

  const raw = await req.text();
  if (raw.length > 256_000) return Response.json({ error: "too_large" }, { status: 413 });

  let body: Record<string, unknown> | null = null;
  try {
    body = (req.headers.get("content-type") ?? "").includes("application/x-www-form-urlencoded")
      ? Object.fromEntries(new URLSearchParams(raw))
      : JSON.parse(raw);
  } catch {
    body = null;
  }

  const log = (ok: boolean, note: string) => {
    run(
      "insert into webhook_log(project_id, webhook_id, platform, ts, ok, note, body) values(?,?,?,?,?,?,?)",
      hook.project_id, hook.id, platform, Date.now(), ok ? 1 : 0, note, raw.slice(0, 6000),
    );
    run(
      "delete from webhook_log where project_id=? and id not in (select id from webhook_log where project_id=? order by id desc limit 50)",
      hook.project_id, hook.project_id,
    );
  };

  const p = (PLATFORMS as readonly string[]).includes(platform) ? (platform as Platform) : "generic";
  if (!body || typeof body !== "object") {
    log(false, "body is not JSON/form");
    return Response.json({ ok: false, error: "unparseable" }); // 200 so the sender does not hammer retries
  }

  // Impultienda sends its store in every event: remember it so Dashboards can map store -> ad account.
  const store = p === "impultienda" ? (body.store as { id?: unknown; name?: unknown } | undefined) : undefined;
  const storeId = typeof store?.id === "string" ? store.id.slice(0, 64) : null;
  if (storeId) {
    run("insert or replace into setting(project_id,key,value) values(?,?,?)", hook.project_id, `store_name:${storeId}`, clip(store?.name, 120) ?? storeId);
  }

  const skip = skipReason(p, body);
  if (skip) {
    log(true, skip);
    return Response.json({ ok: true, skipped: skip });
  }

  const c = normalize(p, body);
  if (!c.orderId) {
    log(false, "no order id found, check field mapping");
    return Response.json({ ok: false, error: "no_order_id" });
  }
  const convId = recordConversion(getProject(), c);
  const acc = storeId && q1<{ value: string }>("select value from setting where project_id=? and key=?", hook.project_id, `store_dash:${storeId}`)?.value;
  // Sales with no campaign id land in the dashboard mapped to their store; attributed ones keep their own campaign.
  if (acc) run("update attribution set ca_id=? where conversion_id=? and ca_id is null", acc, convId);
  log(true, `${c.status} ${c.value} ${clip(c.orderId, 40)}`);
  return Response.json({ ok: true });
}
