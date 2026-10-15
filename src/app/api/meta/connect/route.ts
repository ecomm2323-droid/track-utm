import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { redirectUri } from "@/lib/meta";

export function GET() {
  const client_id = process.env.META_APP_ID;
  if (!client_id) return NextResponse.json({ ok: false, error: "Falta META_APP_ID en .env.local" }, { status: 500 });

  const state = randomBytes(16).toString("hex");
  const url = new URL("https://www.facebook.com/v25.0/dialog/oauth");
  url.search = new URLSearchParams({
    client_id, redirect_uri: redirectUri(), scope: "ads_read", response_type: "code", state,
  }).toString();

  const res = NextResponse.redirect(url);
  res.cookies.set("meta_state", state, { httpOnly: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
