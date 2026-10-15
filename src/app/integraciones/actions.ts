"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getProject, run } from "@/lib/db";
import { PLATFORMS } from "@/lib/webhooks";

export async function createWebhook(form: FormData) {
  const platform = String(form.get("platform") ?? "");
  if (!(PLATFORMS as readonly string[]).includes(platform)) return;
  const name = String(form.get("name") ?? "").trim().slice(0, 80) || platform;
  run(
    "insert into webhook(project_id, platform, name, token, created_at) values(?,?,?,?,?)",
    getProject().id, platform, name, "wh_" + randomBytes(16).toString("hex"), Date.now(),
  );
  revalidatePath("/integraciones");
}

export async function deleteWebhook(form: FormData) {
  run("delete from webhook where id=? and project_id=?", Number(form.get("id")), getProject().id);
  revalidatePath("/integraciones");
}
