import { clip, num } from "./http";
import type { Utm } from "./attribution";
import type { ConversionInput, Status } from "./conversions";

export const PLATFORMS = ["generic", "hotmart", "kiwify", "shopify", "impultienda"] as const;
export type Platform = (typeof PLATFORMS)[number];

const get = (o: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((a, k) => (a && typeof a === "object" ? (a as Record<string, unknown>)[k] : undefined), o);

const first = (o: unknown, ...paths: string[]): unknown => {
  for (const p of paths) {
    const v = get(o, p);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
};

export function mapStatus(raw: unknown): Status {
  const s = String(raw ?? "").toLowerCase();
  if (/refund|reembols|voided/.test(s)) return "refunded";
  if (/charge_?back|dispute/.test(s)) return "chargeback";
  if (/cancel|refus|reject|expir|declin|fail|abandon/.test(s)) return "rejected";
  if (/wait|pend|billet|boleto|delayed|created|process/.test(s)) return "pending";
  if (/approv|paid|complet|confirm|succe|active/.test(s)) return "approved";
  return "pending"; // unknown must not inflate revenue
}

export function mapMethod(raw: unknown): string | null {
  const s = String(raw ?? "").toLowerCase();
  if (!s) return null;
  if (/pix/.test(s)) return "Pix";
  if (/card|cartao|cartão|credit|debit|tarjeta/.test(s)) return "Tarjeta";
  if (/bolet|billet/.test(s)) return "Boleto Bancario";
  return "Otros";
}

function utmFrom(o: unknown, prefix = ""): Utm {
  const u = (k: string) => clip(first(o, prefix + k));
  return {
    utm_source: u("utm_source"),
    utm_medium: u("utm_medium"),
    utm_campaign: u("utm_campaign"),
    utm_content: u("utm_content"),
    utm_term: u("utm_term"),
    ca_id: u("ca_id"),
    as_id: u("as_id"),
    ad_id: u("ad_id"),
    placement: u("placement"),
    fbclid: u("fbclid"),
  };
}

const mergeUtm = (...list: Utm[]): Utm => {
  const out: Record<string, string | null | undefined> = {};
  for (const u of list) for (const [k, v] of Object.entries(u)) out[k] ??= v ?? null;
  return out as Utm;
};

function utmFromUrl(url: unknown): Utm {
  try {
    const sp = new URL(String(url), "http://x").searchParams;
    return utmFrom(Object.fromEntries(sp));
  } catch {
    return {};
  }
}

// The tracker decorates checkout links with ut_vid (and sck=ut_<vid> for Hotmart-style single param).
function vidFrom(o: unknown): string | null {
  const direct = clip(first(o, "ut_vid", "tracking.ut_vid", "TrackingParameters.ut_vid", "data.purchase.origin.ut_vid"), 64);
  if (direct) return direct;
  const sck = String(first(o, "sck", "tracking.sck", "TrackingParameters.sck", "data.purchase.origin.sck") ?? "");
  return sck.startsWith("ut_") ? sck.slice(3, 67) : null;
}

/**
 * shortcut: field paths for hotmart/kiwify/shopify written from memory of their docs.
 * Check each against a real payload in Integraciones > Pruebas (raw bodies are logged) before trusting revenue.
 */
export function normalize(platform: Platform, body: Record<string, unknown>): ConversionInput {
  const base = { name: "purchase", platform, vid: vidFrom(body) };

  if (platform === "impultienda") {
    const t = (k: string) => clip(first(body, `data.tracking.${k}`));
    return {
      ...base,
      orderId: clip(first(body, "data.order_number", "data.order_id")),
      status: mapStatus(first(body, "event")), // order.created|approved|refunded|chargeback|rejected
      value: num(first(body, "data.total")) ?? 0, // seller currency
      currency: clip(first(body, "data.currency"), 8),
      email: clip(first(body, "data.customer.email")),
      product: clip(first(body, "data.items.0.name")),
      paymentMethod: clip(first(body, "data.payment_method")),
      // Only standard UTMs + utm_id (campaign id) travel; Name|id packed values are split by attribute().
      utm: {
        utm_source: t("utm_source"), utm_medium: t("utm_medium"), utm_campaign: t("utm_campaign"),
        utm_content: t("utm_content"), utm_term: t("utm_term"), ca_id: t("utm_id"),
      },
    };
  }

  if (platform === "hotmart") {
    return {
      ...base,
      orderId: clip(first(body, "data.purchase.transaction")),
      status: mapStatus(first(body, "data.purchase.status", "event")),
      value: num(first(body, "data.purchase.price.value", "data.purchase.full_price.value")) ?? 0,
      currency: clip(first(body, "data.purchase.price.currency_value", "data.purchase.price.currency_code"), 8),
      email: clip(first(body, "data.buyer.email")),
      product: clip(first(body, "data.product.name")),
      paymentMethod: mapMethod(first(body, "data.purchase.payment.type")),
      utm: mergeUtm(utmFrom(body), utmFrom(get(body, "data.purchase.origin"))),
    };
  }

  if (platform === "kiwify") {
    const cents = num(first(body, "Commissions.charge_amount", "Commissions.product_base_price"));
    return {
      ...base,
      orderId: clip(first(body, "order_id", "order_ref")),
      status: mapStatus(first(body, "order_status", "webhook_event_type")),
      value: cents !== null ? cents / 100 : 0, // Kiwify sends cents
      currency: clip(first(body, "Commissions.currency"), 8),
      email: clip(first(body, "Customer.email")),
      product: clip(first(body, "Product.product_name")),
      paymentMethod: mapMethod(first(body, "payment_method")),
      utm: mergeUtm(utmFrom(body.TrackingParameters), utmFrom(body)),
    };
  }

  if (platform === "shopify") {
    return {
      ...base,
      orderId: clip(first(body, "id", "order_number")),
      status: mapStatus(first(body, "financial_status")),
      value: num(first(body, "total_price", "current_total_price")) ?? 0,
      currency: clip(first(body, "currency"), 8),
      email: clip(first(body, "email", "customer.email")),
      product: clip(get(body, "line_items.0.title")),
      paymentMethod: mapMethod(first(body, "payment_gateway_names.0", "gateway")),
      // Shopify keeps the first landing URL (with its UTMs) on the order.
      utm: mergeUtm(utmFromUrl(body.landing_site), utmFrom(body)),
    };
  }

  return {
    ...base,
    orderId: clip(first(body, "order_id", "orderId", "transaction_id", "transaction", "id")),
    status: mapStatus(first(body, "status", "order_status", "payment_status")),
    value: num(first(body, "value", "amount", "total", "price", "revenue", "payment.amount", "order.total")) ?? 0,
    currency: clip(first(body, "currency", "payment.currency"), 8),
    email: clip(first(body, "email", "customer.email", "buyer.email")),
    product: clip(first(body, "product", "product_name", "product.name")),
    paymentMethod: mapMethod(first(body, "payment_method", "paymentMethod", "payment.method")),
    utm: mergeUtm(utmFrom(body), utmFrom(body.tracking), utmFrom(body.utm)),
  };
}

// Events that are not sales, plus Impultienda's "Probar" simulacro (test:true / TEST- order id): logged, never stored.
export function skipReason(platform: Platform, body: Record<string, unknown>): string | null {
  if (platform !== "impultienda") return null;
  const ev = String(body.event ?? "");
  if (ev === "order.abandoned" || ev === "order.email_bounced") return `evento ${ev} ignorado`;
  if (body.test === true || String(first(body, "data.order_id") ?? "").startsWith("TEST-")) return "prueba de Impultienda, no se guarda";
  return null;
}
