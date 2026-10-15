import { NextRequest, NextResponse } from "next/server";
import { getProject, run } from "@/lib/db";
import { appUrl, exchangeCode } from "@/lib/meta";

export async function GET(req: NextRequest) {
  const back = (result: string) => NextResponse.redirect(new URL(`/campanas?meta=${result}`, appUrl()));
  const sp = req.nextUrl.searchParams;
  if (sp.get("error")) return back("cancelado");
  if (!sp.get("state") || sp.get("state") !== req.cookies.get("meta_state")?.value) return back("estado-invalido");

  let token: { access_token: string; expires_in: number };
  try {
    token = await exchangeCode(sp.get("code") ?? "");
  } catch (e) {
    console.error("[meta] OAuth falló:", e instanceof Error ? e.message : e);
    return back("error");
  }

  const now = Date.now();
  run(
    `insert into meta_connection(project_id, access_token, expires_at, created_at) values(?,?,?,?)
     on conflict(project_id) do update set access_token=excluded.access_token, expires_at=excluded.expires_at, created_at=excluded.created_at`,
    getProject().id, token.access_token, now + token.expires_in * 1000, now,
  );
  const res = back("ok");
  res.cookies.delete("meta_state");
  return res;
}
