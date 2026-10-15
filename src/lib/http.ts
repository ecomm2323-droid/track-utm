const g = globalThis as unknown as { __rl?: Map<string, { n: number; t: number }> };

function corsHeaders(req: Request): Record<string, string> {
  const o = req.headers.get("origin");
  const h: Record<string, string> = {
    "Access-Control-Allow-Origin": o ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (o) h["Access-Control-Allow-Credentials"] = "true";
  return h;
}

export const preflight = (req: Request) => new Response(null, { status: 204, headers: corsHeaders(req) });

export const json = (req: Request, data: unknown, status = 200) =>
  Response.json(data, { status, headers: corsHeaders(req) });

// The tracker posts text/plain (no CORS preflight), so parse JSON manually.
export async function readJson(req: Request, maxBytes = 8192): Promise<Record<string, unknown> | null> {
  const text = await req.text();
  if (text.length > maxBytes) return null;
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function clip(v: unknown, n = 255): string | null {
  if (v === null || v === undefined || typeof v === "object") return null;
  const s = String(v).trim();
  return s ? s.slice(0, n) : null;
}

export const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  let s = String(v).trim();
  if (s.includes(",") && !s.includes(".")) s = s.replace(",", ".");
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
};

// shortcut: in-memory fixed window, per process. Swap for Upstash Redis when deployed on serverless.
export function limited(key: string, max = 120): boolean {
  const m = (g.__rl ??= new Map());
  const now = Date.now();
  const e = m.get(key);
  if (!e || now - e.t > 60_000) {
    m.set(key, { n: 1, t: now });
    return false;
  }
  e.n++;
  return e.n > max;
}

export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
