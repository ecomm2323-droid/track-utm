import { q, q1, run } from "./db";

export type Utm = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  ca_id?: string | null;
  as_id?: string | null;
  ad_id?: string | null;
  placement?: string | null;
  fbclid?: string | null;
};

type TouchRow = {
  id: number;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  ca_id: string | null;
  as_id: string | null;
  ad_id: string | null;
  fbclid: string | null;
  channel: string;
};

export function channelOf(t: {
  source?: string | null;
  fbclid?: string | null;
  ca_id?: string | null;
  ad_id?: string | null;
  referrer?: string | null;
}): string {
  const s = (t.source ?? "").toLowerCase();
  if (t.fbclid || t.ca_id || t.ad_id || /^(facebook|fb|meta|ig|instagram)/.test(s)) return "meta";
  if (/google|gads/.test(s)) return "google";
  if (/tiktok/.test(s)) return "tiktok";
  if (/kwai/.test(s)) return "kwai";
  if (/taboola/.test(s)) return "taboola";
  if (s) return s;
  if (t.referrer) {
    try {
      return "referral:" + new URL(t.referrer).hostname;
    } catch {
      return "referral";
    }
  }
  return "direct";
}

// UTMify style packs ids into the names: utm_campaign=Name|id, utm_medium=AdSet|id, utm_content=Ad|id, utm_term=placement.
// Returns the shape our macro set uses (ids in ca_id/as_id/ad_id, names in campaign/term/content); other UTMs pass through.
export function splitUtmify(u: Utm): Utm {
  if (!/\|\d+$/.test(u.utm_campaign ?? "")) return u;
  const pair = (v?: string | null) => {
    const m = v?.match(/^(.*)\|(\d+)$/);
    return m ? { name: m[1], id: m[2] } : { name: v ?? null, id: null };
  };
  const camp = pair(u.utm_campaign), adset = pair(u.utm_medium), ad = pair(u.utm_content);
  return {
    ...u,
    utm_campaign: camp.name, ca_id: u.ca_id ?? camp.id,
    utm_term: adset.name, as_id: u.as_id ?? adset.id,
    utm_content: ad.name, ad_id: u.ad_id ?? ad.id,
    placement: u.utm_term ?? u.placement ?? null,
  };
}

export const hasUtm = (u: Utm) => Boolean(u.utm_source || u.utm_campaign || u.ca_id || u.ad_id || u.fbclid);

const confidenceOf = (t: { ca_id: string | null; ad_id: string | null; source: string | null; fbclid: string | null }) =>
  t.ad_id || t.ca_id ? "high" : t.source || t.fbclid ? "medium" : "low";

const isPaid = (t: TouchRow) => Boolean(t.fbclid || t.ca_id || t.ad_id);

function save(
  pid: number,
  convId: number,
  model: string,
  t: Omit<TouchRow, "id"> & { id: number | null },
  confidence: string,
) {
  run(
    `insert or replace into attribution(project_id, conversion_id, model, touch_id, channel, source, medium,
       campaign, adset_name, ad_name, ca_id, as_id, ad_id, confidence) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    pid, convId, model, t.id, t.channel, t.source, t.medium, t.campaign, t.term, t.content,
    t.ca_id, t.as_id, t.ad_id, confidence,
  );
}

/**
 * Writes one attribution row per model. Never invents a campaign:
 * no touch and no payload UTMs => channel "direct", confidence "none".
 */
export function attribute(pid: number, convId: number, vid: string | null, ts: number, windowDays: number, payload?: Utm) {
  const touches = vid
    ? q<TouchRow>(
        "select * from touch where project_id=? and visitor_id=? and ts<=? and ts>=? order by ts, id",
        pid, vid, ts, ts - windowDays * 864e5,
      )
    : [];

  if (touches.length) {
    const first = touches.find(isPaid) ?? touches[0];
    const last = touches[touches.length - 1];
    save(pid, convId, "first_touch", first, confidenceOf(first));
    save(pid, convId, "last_touch", last, confidenceOf(last));
    return;
  }

  const p = splitUtmify(payload ?? {});
  const synthetic = {
    id: null,
    source: p.utm_source ?? null,
    medium: p.utm_medium ?? null,
    campaign: p.utm_campaign ?? null,
    content: p.utm_content ?? null,
    term: p.utm_term ?? null,
    ca_id: p.ca_id ?? null,
    as_id: p.as_id ?? null,
    ad_id: p.ad_id ?? null,
    fbclid: p.fbclid ?? null,
    channel: "direct",
  };
  if (hasUtm(p)) {
    synthetic.channel = channelOf(synthetic);
    for (const m of ["first_touch", "last_touch"]) save(pid, convId, m, synthetic, "payload");
  } else {
    for (const m of ["first_touch", "last_touch"]) save(pid, convId, m, synthetic, "none");
  }
}

export const needsReattribution = (convId: number) =>
  !q1<{ touch_id: number | null }>("select touch_id from attribution where conversion_id=? and touch_id is not null limit 1", convId);
