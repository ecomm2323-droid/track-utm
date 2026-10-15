import { getProject, q, run } from "./db";

export type Dashboard = { id: number; name: string; ad_account_id: string };

// One dashboard per ad account. The first one is seeded from META_AD_ACCOUNT_ID on first use.
export function dashboards(pid = getProject().id): Dashboard[] {
  const list = () => q<Dashboard>("select id, name, ad_account_id from dashboard where project_id=? order by id", pid);
  let rows = list();
  const env = process.env.META_AD_ACCOUNT_ID;
  if (!rows.length && env) {
    run(
      "insert into dashboard(project_id, name, ad_account_id, created_at) values(?,?,?,?)",
      pid, "Principal", env, Date.now(),
    );
    rows = list();
  }
  return rows;
}

// Accepts "1234567890" or "act_1234567890"; returns the canonical act_ form or null.
export function normalizeAccount(raw: string): string | null {
  const digits = raw.trim().replace(/^act_/i, "");
  return /^\d{5,}$/.test(digits) ? `act_${digits}` : null;
}
