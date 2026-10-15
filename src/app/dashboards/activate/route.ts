import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db";
import { dashboards } from "@/lib/dashboards";
import { DASH_COOKIE } from "@/lib/active-dashboard";
import { appUrl } from "@/lib/meta";

// Sets the active dashboard cookie, but only for a dashboard that belongs to this project.
export function GET(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get("id"));
  const ok = dashboards(getProject().id).some((d) => d.id === id);
  const res = NextResponse.redirect(new URL("/", appUrl()));
  if (ok) res.cookies.set(DASH_COOKIE, String(id), { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  return res;
}
