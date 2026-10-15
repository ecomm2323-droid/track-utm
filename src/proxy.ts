import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, authToken } from "@/lib/auth";

// Reachable without a session: the tracker, checkout webhooks and the login itself.
const PUBLIC = ["/api/collect", "/api/events", "/api/webhooks", "/tracker.js", "/login"];

export function proxy(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();
  if (!password) {
    // Fail closed in production: a deploy without APP_PASSWORD must never expose the panel. Local dev stays open.
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("Falta la variable APP_PASSWORD en el servidor.", { status: 503 });
    }
    return NextResponse.next();
  }
  if (req.cookies.get(AUTH_COOKIE)?.value === authToken(password)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
