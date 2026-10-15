import { randomUUID } from "node:crypto";
import { getProject, q1, run } from "@/lib/db";
import { recordConversion } from "@/lib/conversions";
import { clientIp, clip, json, limited, num, preflight, readJson } from "@/lib/http";

export const OPTIONS = preflight;

const CONVERSIONS = new Set(["purchase", "lead"]);

export async function POST(req: Request) {
  const b = await readJson(req);
  if (!b) return json(req, { error: "bad_request" }, 400);

  const key = clip(b.key, 64);
  const project = key ? q1<{ id: number }>("select id from project where public_key=?", key) : undefined;
  if (!project) return json(req, { error: "unknown_key" }, 401);
  if (limited(`${clientIp(req)}|${key}`)) return json(req, { error: "rate_limited" }, 429);

  const name = clip(b.event, 64);
  if (!name) return json(req, { error: "missing_event" }, 400);

  const vid = clip(b.vid, 64);
  const eventId = clip(b.event_id, 64) ?? randomUUID();
  const orderId = clip(b.order_id, 128);
  const value = num(b.value);
  const currency = clip(b.currency, 8);

  // event_id is unique per project: a retried or duplicate send is a no-op (also the CAPI dedup key later).
  const r = run(
    `insert or ignore into event(project_id, visitor_id, event_id, name, value, currency, order_id, url, ts)
     values(?,?,?,?,?,?,?,?,?)`,
    project.id, vid, eventId, name, value, currency, orderId, clip(b.url, 1024), Date.now(),
  );
  if (!r.changes) return json(req, { ok: true, duplicate: true, event_id: eventId });

  if (CONVERSIONS.has(name)) {
    // shortcut: a browser purchase counts as approved, so anyone with the public key can post one.
    // Treat webhooks as the source of truth for revenue; this just links visitor to order early.
    recordConversion(getProject(), {
      orderId,
      name,
      status: "approved",
      value: value ?? 0,
      currency,
      platform: "tracker",
      product: null,
      paymentMethod: null,
      email: clip(b.email),
      vid,
    });
  }
  return json(req, { ok: true, event_id: eventId });
}
