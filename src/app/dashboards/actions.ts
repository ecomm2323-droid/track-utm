"use server";

import { revalidatePath } from "next/cache";
import { getProject, run } from "@/lib/db";
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

export async function deleteDashboard(form: FormData) {
  run("delete from dashboard where id=? and project_id=?", Number(form.get("id")), getProject().id);
  revalidatePath("/dashboards");
}
