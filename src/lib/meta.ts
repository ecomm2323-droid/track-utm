import { getProject, q1, run } from "./db";
import { dashboards } from "./dashboards";

const API = "https://graph.facebook.com/v25.0";
const FIELDS = "campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,clicks,impressions,actions";

export const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";
export const redirectUri = () => `${appUrl()}/api/meta/callback`;

// OAuth token saved by /api/meta/callback wins; META_ACCESS_TOKEN in .env.local is the fallback.
export function metaToken(pid: number): string | undefined {
  const c = q1<{ access_token: string; expires_at: number }>(
    "select access_token, expires_at from meta_connection where project_id=?", pid,
  );
  if (c && c.expires_at > Date.now()) return c.access_token;
  return process.env.META_ACCESS_TOKEN;
}

async function graph<T>(path: string): Promise<T> {
  const body = (await (await fetch(API + path, { cache: "no-store" })).json()) as T & { error?: { message: string } };
  if (body.error) throw new Error("Meta: " + body.error.message);
  return body;
}

// Code from the login dialog -> short token -> long-lived token (~60 days).
export async function exchangeCode(code: string) {
  const client_id = process.env.META_APP_ID;
  const client_secret = process.env.META_APP_SECRET;
  if (!client_id || !client_secret) throw new Error("Faltan META_APP_ID o META_APP_SECRET en .env.local");
  const short = await graph<{ access_token: string }>(
    "/oauth/access_token?" + new URLSearchParams({ client_id, client_secret, redirect_uri: redirectUri(), code }),
  );
  return graph<{ access_token: string; expires_in: number }>(
    "/oauth/access_token?" +
      new URLSearchParams({ grant_type: "fb_exchange_token", client_id, client_secret, fb_exchange_token: short.access_token }),
  );
}

type InsightRow = {
  date_start: string;
  campaign_id: string;
  campaign_name: string;
  adset_id: string;
  adset_name: string;
  ad_id: string;
  ad_name: string;
  spend?: string;
  clicks?: string;
  impressions?: string;
  actions?: { action_type: string; value: string }[];
};
type InsightPage = { data?: InsightRow[]; paging?: { next?: string }; error?: { message: string } };

// Pixel "Initiate checkout" count; Meta repeats it under two names, so take one to avoid double counting.
const initiateCheckouts = (r: InsightRow) =>
  Number(
    r.actions?.find((a) => a.action_type === "initiate_checkout")?.value ??
      r.actions?.find((a) => a.action_type === "offsite_conversion.fb_pixel_initiate_checkout")?.value ??
      0,
  );

// Local calendar day as YYYY-MM-DD (matches the date strings Meta returns for the ad account).
export const ymd = (ms: number) => new Date(ms).toLocaleDateString("sv-SE");

// shortcut: fixed window re-pulled on every sync; upsert by (ad, date) so restated days overwrite. Upgrade to a cron + incremental pulls later.
export async function syncMeta(account: string, days = 30): Promise<{ rows: number; since: string; until: string }> {
  const pid = getProject().id;
  const token = metaToken(pid);
  if (!token) throw new Error("Meta no conectado: usá Conectar con Meta o revisá .env.local");

  const now = Date.now();
  const since = ymd(now - days * 864e5);
  const until = ymd(now);
  const params = new URLSearchParams({
    level: "ad",
    time_increment: "1",
    time_range: JSON.stringify({ since, until }),
    fields: FIELDS,
    limit: "500",
    access_token: token,
  });

  let url: string | undefined = `${API}/${account}/insights?${params}`;
  let n = 0;
  while (url) {
    const body = (await (await fetch(url, { cache: "no-store" })).json()) as InsightPage;
    if (body.error) throw new Error("Meta: " + body.error.message);
    for (const r of body.data ?? []) {
      run(
        `insert into meta_ad_day(project_id, ad_account_id, ad_id, date, campaign_id, campaign_name, adset_id, adset_name, ad_name, spend, clicks, impressions, ic, synced_at)
         values(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         on conflict(project_id, ad_id, date) do update set ad_account_id=excluded.ad_account_id, campaign_id=excluded.campaign_id, campaign_name=excluded.campaign_name,
           adset_id=excluded.adset_id, adset_name=excluded.adset_name, ad_name=excluded.ad_name,
           spend=excluded.spend, clicks=excluded.clicks, impressions=excluded.impressions, ic=excluded.ic, synced_at=excluded.synced_at`,
        pid, account, r.ad_id, r.date_start, r.campaign_id, r.campaign_name, r.adset_id, r.adset_name, r.ad_name,
        Number(r.spend ?? 0), Number(r.clicks ?? 0), Number(r.impressions ?? 0), initiateCheckouts(r), now,
      );
      n++;
    }
    url = body.paging?.next;
  }
  await syncEntities(pid, account, token, now);
  return { rows: n, since, until };
}

type Entity = {
  id: string; name?: string; effective_status?: string; updated_time?: string;
  daily_budget?: string; lifetime_budget?: string; bid_amount?: string;
  daily_min_spend_target?: string; daily_spend_cap?: string; campaign_id?: string; adset_id?: string;
};

// Meta money fields come as minor units ("2500" = 25.00); "0"/missing means not set.
// shortcut: assumes a 2-decimal currency (USD, ARS, EUR...); zero-decimal ones like JPY would be 100x off.
const money = (v?: string) => (v && Number(v) > 0 ? Number(v) / 100 : null);

// Status, budgets and limits per campaign/adset/ad. Not in insights, so fetched from the object edges.
async function syncEntities(pid: number, account: string, token: string, now: number) {
  const edges = [
    ["campaign", "campaigns", "id,name,effective_status,updated_time,daily_budget,lifetime_budget"],
    ["adset", "adsets", "id,name,effective_status,updated_time,daily_budget,lifetime_budget,bid_amount,daily_min_spend_target,daily_spend_cap,campaign_id"],
    ["ad", "ads", "id,name,effective_status,updated_time,adset_id"],
  ] as const;
  for (const [level, edge, fields] of edges) {
    let url: string | undefined = `${API}/${account}/${edge}?${new URLSearchParams({ fields, limit: "500", access_token: token })}`;
    while (url) {
      const body = (await (await fetch(url, { cache: "no-store" })).json()) as { data?: Entity[]; paging?: { next?: string }; error?: { message: string } };
      if (body.error) throw new Error("Meta: " + body.error.message);
      for (const e of body.data ?? []) {
        run(
          `insert into meta_entity(project_id, ad_account_id, level, id, name, status, parent_id, daily_budget, lifetime_budget, bid_amount, min_spend, max_spend, updated_time, synced_at)
           values(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
           on conflict(project_id, level, id) do update set ad_account_id=excluded.ad_account_id, name=excluded.name, status=excluded.status,
             parent_id=excluded.parent_id, daily_budget=excluded.daily_budget, lifetime_budget=excluded.lifetime_budget, bid_amount=excluded.bid_amount,
             min_spend=excluded.min_spend, max_spend=excluded.max_spend, updated_time=excluded.updated_time, synced_at=excluded.synced_at`,
          pid, account, level, e.id, e.name, e.effective_status, e.campaign_id ?? e.adset_id,
          money(e.daily_budget), money(e.lifetime_budget), money(e.bid_amount),
          money(e.daily_min_spend_target), money(e.daily_spend_cap),
          e.updated_time ? Date.parse(e.updated_time) : null, now,
        );
      }
      url = body.paging?.next;
    }
  }
}

// Sync every dashboard's ad account, one after another. Errors per account are reported, not thrown.
export async function syncAll(): Promise<{ account: string; rows?: number; error?: string }[]> {
  const out: { account: string; rows?: number; error?: string }[] = [];
  for (const d of dashboards()) {
    try {
      out.push({ account: d.ad_account_id, rows: (await syncMeta(d.ad_account_id)).rows });
    } catch (e) {
      out.push({ account: d.ad_account_id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}
