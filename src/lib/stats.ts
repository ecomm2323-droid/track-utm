import { q, q1 } from "./db";
import { ymd } from "./meta";

export const PERIODS = { hoy: "Hoy", ayer: "Ayer", "7d": "7 días", "30d": "30 días" } as const;
export type Period = keyof typeof PERIODS | "custom";
export const MODELS = { last_touch: "Último clic", first_touch: "Primer clic" } as const;
export type Model = keyof typeof MODELS;

// Which revenue the dashboards show: gross sale value or net after taxes (product_net), both in USD.
export const BASIS = { bruta: "Bruta", neta: "Neta" } as const;
export type Basis = keyof typeof BASIS;
export const asBasis = (v?: string): Basis => (v === "neta" ? "neta" : "bruta");

export const asPeriod = (v?: string): Period => (v === "custom" || (v && v in PERIODS) ? (v as Period) : "hoy");
export const asModel = (v?: string): Model => (v && v in MODELS ? (v as Model) : "last_touch");

// Sales arrive in the seller currency (ARS) while Meta spend is USD. Convert with the saved dollar rate
// (ARS per USD); rate 1 until it is set, which is the old behaviour. Sales already in USD are left as is.
// Net = what is left per unit after taxes/fees (product_net, in ARS); unset products fall back to the gross value.
export const usdRate = (pid: number) => {
  const v = Number(q1<{ value: string }>("select value from setting where project_id=? and key='usd_rate'", pid)?.value);
  return v > 0 ? v : 1;
};
const grossUsd = (c: string, r: number) => `(case when ${c}.currency='USD' then ${c}.value else ${c}.value/${r} end)`;
const netUsd = (c: string, r: number) =>
  `(case when ${c}.currency='USD' then ${c}.value else coalesce((select n.net_ars from product_net n where n.project_id=${c}.project_id and n.product=${c}.product), ${c}.value)/${r} end)`;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const parseDay = (v?: string) => {
  if (!v || !DATE.test(v)) return undefined;
  const [y, m, d] = v.split("-").map(Number);
  const t = new Date(y, m - 1, d);
  return t.getMonth() === m - 1 ? t.getTime() : undefined; // rejects 2026-02-31
};

// shortcut: server-local day boundaries; switch to the ad account timezone once Meta is connected.
// custom: f/t are inclusive YYYY-MM-DD days (swapped if reversed); invalid input falls back to today.
export function range(p: Period, f?: string, t?: string): { from: number; to: number } {
  const n = new Date();
  const sod = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  const day = 864e5;
  if (p === "custom") {
    const a = parseDay(f);
    const b = parseDay(t) ?? a;
    if (a !== undefined && b !== undefined) return { from: Math.min(a, b), to: Math.max(a, b) + day };
  }
  if (p === "ayer") return { from: sod - day, to: sod };
  if (p === "7d") return { from: sod - 6 * day, to: sod + day };
  if (p === "30d") return { from: sod - 29 * day, to: sod + day };
  return { from: sod, to: sod + day };
}

// Sales of one ad account = conversions whose attributed campaign has spend in that account.
// Expects `c` = conversion alias; placeholders: model, project_id, ad_account_id.
const ACC_SALES = `c.id in (select a.conversion_id from attribution a where a.model=? and a.ca_id in
  (select campaign_id from meta_ad_day where project_id=? and ad_account_id=?))`;

export function overview(pid: number, from: number, to: number, model: Model, acc: string) {
  const r = usdRate(pid);
  const k = q1<Record<string, number>>(
    `select coalesce(sum(case when status='approved' then ${grossUsd("c", r)} end),0) rev,
            coalesce(sum(case when status='approved' then ${netUsd("c", r)} end),0) net,
            coalesce(sum(status='approved'),0) approved,
            coalesce(sum(status='pending'),0) pending,
            coalesce(sum(case when status='pending' then ${grossUsd("c", r)} end),0) pending_value,
            coalesce(sum(status='rejected'),0) rejected,
            coalesce(sum(status='refunded'),0) refunded,
            coalesce(sum(case when status='refunded' then ${grossUsd("c", r)} end),0) refunded_value,
            coalesce(sum(status='chargeback'),0) chargebacks,
            count(*) total
       from conversion c where c.project_id=? and c.ts>=? and c.ts<? and ${ACC_SALES}`,
    pid, from, to, model, pid, acc,
  )!;

  const byMethod = q<{ label: string; n: number; ok: number; denom: number }>(
    `select coalesce(payment_method,'Otros') label, sum(status='approved') n,
            sum(status='approved') ok, sum(status in ('approved','rejected')) denom
       from conversion c where c.project_id=? and c.ts>=? and c.ts<? and ${ACC_SALES} group by label order by n desc`,
    pid, from, to, model, pid, acc,
  );
  const bySource = q<{ label: string; n: number; rev: number; net: number }>(
    `select a.channel label, count(*) n, sum(${grossUsd("c", r)}) rev, sum(${netUsd("c", r)}) net from conversion c
       join attribution a on a.conversion_id=c.id and a.model=?
      where c.project_id=? and c.status='approved' and c.ts>=? and c.ts<? and ${ACC_SALES} group by a.channel order by n desc`,
    model, pid, from, to, model, pid, acc,
  );
  const byProduct = q<{ label: string; n: number; rev: number; net: number }>(
    `select coalesce(product,'Sin producto') label, count(*) n, sum(${grossUsd("c", r)}) rev, sum(${netUsd("c", r)}) net from conversion c
      where c.project_id=? and c.status='approved' and c.ts>=? and c.ts<? and ${ACC_SALES} group by label order by n desc`,
    pid, from, to, model, pid, acc,
  );
  const spend = q1<{ spend: number; clicks: number; impressions: number }>(
    `select coalesce(sum(spend),0) spend, coalesce(sum(clicks),0) clicks, coalesce(sum(impressions),0) impressions
       from meta_ad_day where project_id=? and ad_account_id=? and date>=? and date<?`,
    pid, acc, ymd(from), ymd(to),
  )!;
  return { k, byMethod, bySource, byProduct, spend };
}

export const lastSync = (pid: number) =>
  q1<{ t: number | null }>("select max(synced_at) t from meta_ad_day where project_id=?", pid)?.t ?? null;

export type Level = "campaign" | "adset" | "ad";
// id: touch/attribution column (our join key) · name: attribution name · touchName: touch column for the name
// metaId/metaName: Meta insight columns
const COLS: Record<Level, { id: string; name: string; touchName: string; metaId: string; metaName: string }> = {
  campaign: { id: "ca_id", name: "campaign", touchName: "campaign", metaId: "campaign_id", metaName: "campaign_name" },
  adset: { id: "as_id", name: "adset_name", touchName: "term", metaId: "adset_id", metaName: "adset_name" },
  ad: { id: "ad_id", name: "ad_name", touchName: "content", metaId: "ad_id", metaName: "ad_name" },
};

export type Row = {
  id: string; name: string; status: string | null; updated: number | null;
  budget: number | null; bid: number | null; minSpend: number | null; maxSpend: number | null;
  sales: number; revenue: number; net: number; spend: number; clicks: number; impressions: number; ic: number;
};

type Entity = {
  id: string; name: string | null; status: string | null; updated_time: number | null;
  daily_budget: number | null; lifetime_budget: number | null; bid_amount: number | null;
  min_spend: number | null; max_spend: number | null;
};

// One row per campaign/adset/ad of the account that spent, sold or is active in the period.
const ph = (a: string[]) => a.map(() => "?").join(",");

// Ids allowed at `level` when campaigns (c) / adsets (s) are picked as filters; undefined = no filter.
// Adsets filter by their campaign; ads by the picked adsets, else by the adsets of the picked campaigns.
function scope(pid: number, acc: string, level: Level, c: string[], s: string[]): Set<string> | undefined {
  const ids = (sql: string, ...p: unknown[]) => q<{ id: string }>(sql, ...p).map((r) => r.id);
  const adsetsOf = (cs: string[]) => [...ids(
    `select adset_id id from meta_ad_day where project_id=? and ad_account_id=? and campaign_id in (${ph(cs)})
     union select id from meta_entity where project_id=? and ad_account_id=? and level='adset' and parent_id in (${ph(cs)})`,
    pid, acc, ...cs, pid, acc, ...cs,
  )];
  if (level === "adset" && c.length) return new Set(adsetsOf(c));
  if (level === "ad" && (s.length || c.length)) {
    const as = s.length ? s : adsetsOf(c);
    if (!as.length) return new Set();
    return new Set(ids(
      `select ad_id id from meta_ad_day where project_id=? and ad_account_id=? and adset_id in (${ph(as)})
       union select id from meta_entity where project_id=? and ad_account_id=? and level='ad' and parent_id in (${ph(as)})`,
      pid, acc, ...as, pid, acc, ...as,
    ));
  }
  return undefined;
}

export function byLevel(pid: number, from: number, to: number, model: Model, level: Level, acc: string, camps: string[] = [], sets: string[] = []): Row[] {
  const c = COLS[level];
  const metrics = q<{ id: string; name: string | null; spend: number; clicks: number; impressions: number; ic: number }>(
    `select ${c.metaId} id, max(${c.metaName}) name, sum(spend) spend, sum(clicks) clicks, sum(impressions) impressions, sum(ic) ic
       from meta_ad_day where project_id=? and ad_account_id=? and date>=? and date<? group by ${c.metaId}`,
    pid, acc, ymd(from), ymd(to),
  );
  const r = usdRate(pid);
  const sales = q<{ id: string; name: string | null; sales: number; revenue: number; net: number }>(
    `select a.${c.id} id, max(a.${c.name}) name, count(*) sales, coalesce(sum(${grossUsd("cv", r)}),0) revenue,
            coalesce(sum(${netUsd("cv", r)}),0) net
       from conversion cv join attribution a on a.conversion_id=cv.id and a.model=?
      where cv.project_id=? and cv.status='approved' and cv.ts>=? and cv.ts<? and a.channel='meta'
        and a.${c.id} in (select ${c.metaId} from meta_ad_day where project_id=? and ad_account_id=?)
      group by a.${c.id}`,
    model, pid, from, to, pid, acc,
  );
  const entities = q<Entity>(
    `select id, name, status, updated_time, daily_budget, lifetime_budget, bid_amount, min_spend, max_spend
       from meta_entity where project_id=? and ad_account_id=? and level=?`,
    pid, acc, level,
  );
  // A campaign with budget at adset level (ABO) has none of its own: sum its active adsets' budgets and limits.
  const kids = new Map(
    q<{ parent_id: string; budget: number | null; min_spend: number | null; max_spend: number | null }>(
      `select parent_id, sum(daily_budget) budget, sum(min_spend) min_spend, sum(max_spend) max_spend
         from meta_entity where project_id=? and ad_account_id=? and level='adset' and status='ACTIVE' group by parent_id`,
      pid, acc,
    ).map((k) => [k.parent_id, k]),
  );

  const rows = new Map<string, Row>();
  const row = (id: string, name: string | null) => {
    let r = rows.get(id);
    if (!r) {
      rows.set(id, (r = {
        id, name: name ?? "Sin identificar", status: null, updated: null, budget: null, bid: null,
        minSpend: null, maxSpend: null, sales: 0, revenue: 0, net: 0, spend: 0, clicks: 0, impressions: 0, ic: 0,
      }));
    }
    if (name && r.name === "Sin identificar") r.name = name;
    return r;
  };
  for (const m of metrics) Object.assign(row(m.id, m.name), { spend: m.spend, clicks: m.clicks, impressions: m.impressions, ic: m.ic });
  for (const s of sales) Object.assign(row(s.id, s.name), { sales: s.sales, revenue: s.revenue, net: s.net });
  for (const e of entities) {
    const k = level === "campaign" ? kids.get(e.id) : undefined;
    const r = row(e.id, e.name);
    r.name = e.name ?? r.name;
    r.status = e.status;
    r.updated = e.updated_time;
    r.budget = e.daily_budget ?? e.lifetime_budget ?? k?.budget ?? null;
    r.bid = e.bid_amount;
    r.minSpend = e.min_spend ?? k?.min_spend ?? null;
    r.maxSpend = e.max_spend ?? k?.max_spend ?? null;
  }
  const allowed = scope(pid, acc, level, camps, sets);
  return [...rows.values()]
    .filter((r) => !allowed || allowed.has(r.id))
    .filter((r) => r.spend || r.sales || r.clicks || r.status === "ACTIVE")
    .sort((a, b) => b.spend - a.spend || b.revenue - a.revenue);
}

export type SaleRow = {
  id: number; ts: number; order_id: string; status: string; value: number; currency: string | null;
  platform: string | null; product: string | null; payment_method: string | null; email: string | null;
  channel: string | null; campaign: string | null; ad_name: string | null; ad_id: string | null; confidence: string | null;
  usd: number; net: number;
};

export const sales = (pid: number, from: number, to: number, model: Model, acc: string, limit = 200) => {
  const r = usdRate(pid);
  return q<SaleRow>(
    `select c.id, c.ts, c.order_id, c.status, c.value, c.currency, c.platform, c.product, c.payment_method, c.email,
            a.channel, a.campaign, a.ad_name, a.ad_id, a.confidence,
            ${grossUsd("c", r)} usd, ${netUsd("c", r)} net
       from conversion c left join attribution a on a.conversion_id=c.id and a.model=?
      where c.project_id=? and c.ts>=? and c.ts<? and ${ACC_SALES} order by c.ts desc limit ?`,
    model, pid, from, to, model, pid, acc, limit,
  );
};
