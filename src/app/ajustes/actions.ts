"use server";

import { revalidatePath } from "next/cache";
import { getProject, run } from "@/lib/db";

export async function savePricing(form: FormData) {
  const pid = getProject().id;
  const rate = Number(String(form.get("rate") ?? "").replace(",", "."));
  if (rate > 0 && rate < 1e6) run("insert or replace into setting(project_id,key,value) values(?,'usd_rate',?)", pid, String(rate));
  // product_<i> / net_<i> pairs; an empty net clears the product back to "gross value".
  for (const [k, v] of form.entries()) {
    const m = /^product_(\d+)$/.exec(k);
    if (!m) continue;
    const product = String(v).slice(0, 200);
    const net = Number(String(form.get(`net_${m[1]}`) ?? "").replace(",", "."));
    if (net > 0 && net < 1e12) run("insert or replace into product_net(project_id,product,net_ars) values(?,?,?)", pid, product, net);
    else run("delete from product_net where project_id=? and product=?", pid, product);
  }
  revalidatePath("/", "layout");
}
