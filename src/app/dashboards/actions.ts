"use server";

import { revalidatePath } from "next/cache";
import { getProject, q1, run } from "@/lib/db";
import { normalizeAccount } from "@/lib/dashboards";

export async function createDashboard(form: FormData) {
  const acc = normalizeAccount(String(form.get("account") ?? ""));
  if (!acc) return;
  const name = String(form.get("name") ?? "").trim().slice(0, 80) || acc;
  run(
    "insert or ignore into dashboard(project_id, name, ad_account_id, created_at) values(?,?,?,?)",
    getProject().id, name, acc, Date.now(),
  );
  revalidatePath("/dashboards");
}

export async function mapStore(form: FormData) {
  const store = String(form.get("store") ?? "").slice(0, 64);
  const acc = String(form.get("account") ?? "");
  const pid = getProject().id;
  if (!store) return;
  if (acc && q1("select 1 from dashboard where project_id=? and ad_account_id=?", pid, acc)) {
    run("insert or replace into setting(project_id,key,value) values(?,?,?)", pid, `store_dash:${store}`, acc);
  } else run("delete from setting where project_id=? and key=?", pid, `store_dash:${store}`);
  revalidatePath("/dashboards");
}

export async function deleteDashboard(form: FormData) {
  run("delete from dashboard where id=? and project_id=?", Number(form.get("id")), getProject().id);
  revalidatePath("/dashboards");
}
