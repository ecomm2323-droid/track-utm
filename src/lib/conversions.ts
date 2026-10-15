import { randomUUID } from "node:crypto";
import { q1, run, type Project } from "./db";
import { attribute, hasUtm, needsReattribution, type Utm } from "./attribution";

export type Status = "approved" | "pending" | "refunded" | "rejected" | "chargeback";

export type ConversionInput = {
  orderId: string | null;
  name: string;
  status: Status;
  value: number;
  currency: string | null;
  platform: string | null;
  product: string | null;
  paymentMethod: string | null;
  email: string | null;
  vid: string | null;
  utm?: Utm;
};

/**
 * Upsert by (project, order_id): a browser "purchase" event and the checkout webhook
 * for the same order merge into one row, so status changes (refund, chargeback) update it.
 */
export function recordConversion(project: Project, c: ConversionInput): number {
  const now = Date.now();
  const orderId = c.orderId ?? "auto_" + randomUUID();
  const existing = q1<{ id: number; visitor_id: string | null; ts: number }>(
    "select id, visitor_id, ts from conversion where project_id=? and order_id=?",
    project.id, orderId,
  );

  if (existing) {
    // Never wipe known fields with nulls from a thinner payload.
    run(
      `update conversion set status=?, value=case when ?>0 then ? else value end, currency=coalesce(?,currency),
         platform=coalesce(?,platform), product=coalesce(?,product), payment_method=coalesce(?,payment_method),
         email=coalesce(?,email), visitor_id=coalesce(visitor_id,?), updated_at=? where id=?`,
      c.status, c.value, c.value, c.currency, c.platform, c.product, c.paymentMethod, c.email, c.vid, now, existing.id,
    );
    const vid = existing.visitor_id ?? c.vid;
    // A later event without UTMs (refund, retry) must not overwrite a known attribution with "direct".
    if ((vid || (c.utm && hasUtm(c.utm))) && needsReattribution(existing.id)) {
      attribute(project.id, existing.id, vid, existing.ts, project.attribution_window_days, c.utm);
    }
    return existing.id;
  }

  const r = run(
    `insert into conversion(project_id, order_id, name, status, value, currency, platform, product, payment_method,
       email, visitor_id, ts, updated_at) values(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    project.id, orderId, c.name, c.status, c.value, c.currency, c.platform, c.product, c.paymentMethod,
    c.email, c.vid, now, now,
  );
  const id = Number(r.lastInsertRowid);
  attribute(project.id, id, c.vid, now, project.attribution_window_days, c.utm);
  return id;
}
