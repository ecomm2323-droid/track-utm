import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getProject, q1, run } from "./db";
import { dashboards } from "./dashboards";

const KEY = "import_impultienda_diarios_v1";

// One-off load of Impultienda sales that predate the webhook, from import/impultienda-diarios.json.
// They carry no UTMs, so they are stored with channel "sin_atribucion" and tied to the first dashboard's ad account
// (stats' ACC_SALES matches that account id). Orders already received by webhook are skipped, so nothing is double counted.
// shortcut: bundled JSON, not an API pull; repeat the file + a new KEY to load another period.
export function importHistory(): number {
  const pid = getProject().id;
  if (q1("select 1 from setting where project_id=? and key=?", pid, KEY)) return 0;
  const acc = dashboards(pid)[0]?.ad_account_id;
  if (!acc) return 0; // no dashboard yet: try again on the next sync

  const file = JSON.parse(readFileSync(join(process.cwd(), "import", "impultienda-diarios.json"), "utf8")) as {
    currency: string;
    orders: [number, string, number, string][];
  };
  const now = Date.now();
  let n = 0;
  for (const [order, iso, value, method] of file.orders) {
    const id = String(order);
    if (q1("select 1 from conversion where project_id=? and (order_id=? or order_id like ?)", pid, id, `%${id}`)) continue;
    const r = run(
      `insert into conversion(project_id, order_id, name, status, value, currency, platform, payment_method, ts, updated_at)
       values(?,?,?,?,?,?,?,?,?,?)`,
      pid, id, "purchase", "approved", value, file.currency, "impultienda", method, Date.parse(iso), now,
    );
    for (const model of ["last_touch", "first_touch"]) {
      run(
        "insert into attribution(project_id, conversion_id, model, channel, ca_id, confidence) values(?,?,?,?,?,?)",
        pid, Number(r.lastInsertRowid), model, "sin_atribucion", acc, "none",
      );
    }
    n++;
  }
  run("insert or replace into setting(project_id,key,value) values(?,?,?)", pid, KEY, String(n));
  return n;
}

// One-off fix for orders Impultienda approved but the webhook never delivered (stuck "pending" or missing).
// Compared against Impultienda's own approved list on 2026-10-19. shortcut: hardcoded list, run once via KEY.
const FIX_KEY = "fix_impultienda_2026_10_19";
const STUCK = ["1693900", "1675857", "1651518"];
const MISSING: [string, string, number, string][] = [["1591200", "2026-10-16T10:40:50Z", 16990, "card"]];

export function reconcile(): number {
  const pid = getProject().id;
  if (q1("select 1 from setting where project_id=? and key=?", pid, FIX_KEY)) return 0;
  const acc = dashboards(pid)[0]?.ad_account_id;
  if (!acc) return 0;
  const now = Date.now();
  let n = 0;
  for (const id of STUCK) {
    n += Number(run("update conversion set status='approved', updated_at=? where project_id=? and status<>'approved' and (order_id=? or order_id like ?)", now, pid, id, `%${id}`).changes);
  }
  for (const [id, iso, value, method] of MISSING) {
    if (q1("select 1 from conversion where project_id=? and (order_id=? or order_id like ?)", pid, id, `%${id}`)) continue;
    const r = run(
      `insert into conversion(project_id, order_id, name, status, value, currency, platform, payment_method, ts, updated_at)
       values(?,?,?,?,?,?,?,?,?,?)`,
      pid, id, "purchase", "approved", value, "ARS", "impultienda", method, Date.parse(iso), now,
    );
    for (const model of ["last_touch", "first_touch"]) {
      run("insert into attribution(project_id, conversion_id, model, channel, ca_id, confidence) values(?,?,?,?,?,?)",
        pid, Number(r.lastInsertRowid), model, "sin_atribucion", acc, "none");
    }
    n++;
  }
  run("insert or replace into setting(project_id,key,value) values(?,?,?)", pid, FIX_KEY, String(n));
  return n;
}
