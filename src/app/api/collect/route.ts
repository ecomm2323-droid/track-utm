import { q1, run } from "@/lib/db";
import { channelOf, splitUtmify } from "@/lib/attribution";
import { clientIp, clip, json, limited, preflight, readJson } from "@/lib/http";

export const OPTIONS = preflight;

// Public endpoint, auth = project public key. shortcut: no Origin/domain allowlist yet, add before selling.
export async function POST(req: Request) {
  const b = await readJson(req);
  if (!b) return json(req, { error: "bad_request" }, 400);

  const key = clip(b.key, 64);
  const project = key ? q1<{ id: number }>("select id from project where public_key=?", key) : undefined;
  if (!project) return json(req, { error: "unknown_key" }, 401);
  if (limited(`${clientIp(req)}|${key}`)) return json(req, { error: "rate_limited" }, 429);

  const vid = clip(b.vid, 64);
  if (!vid) return json(req, { error: "missing_vid" }, 400);

  const now = Date.now();
  run(
    `insert into visitor(project_id, id, first_seen, last_seen) values(?,?,?,?)
     on conflict(project_id, id) do update set last_seen=excluded.last_seen`,
    project.id, vid, now, now,
  );

  const u = splitUtmify({
    utm_source: clip(b.utm_source), utm_medium: clip(b.utm_medium), utm_campaign: clip(b.utm_campaign),
    utm_content: clip(b.utm_content), utm_term: clip(b.utm_term),
    ca_id: clip(b.ca_id, 64), as_id: clip(b.as_id, 64), ad_id: clip(b.ad_id, 64), placement: clip(b.placement, 64),
  });
  const t = {
    source: u.utm_source, medium: u.utm_medium, campaign: u.utm_campaign, content: u.utm_content, term: u.utm_term,
    ca_id: u.ca_id, as_id: u.as_id, ad_id: u.ad_id, placement: u.placement,
    fbclid: clip(b.fbclid, 512),
    referrer: clip(b.referrer, 512),
  };

  run(
    `insert into touch(project_id, visitor_id, ts, source, medium, campaign, content, term, ca_id, as_id, ad_id,
       placement, fbclid, fbc, fbp, referrer, landing_url, channel) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    project.id, vid, now, t.source, t.medium, t.campaign, t.content, t.term, t.ca_id, t.as_id, t.ad_id,
    t.placement, t.fbclid, clip(b.fbc, 512), clip(b.fbp, 128), t.referrer, clip(b.url, 1024), channelOf(t),
  );
  return json(req, { ok: true });
}
