import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db";
import { dashboards } from "@/lib/dashboards";
import { mcpKey } from "@/lib/mcp-key";
import { asModel, asPeriod, byLevel, daily, overview, range, sales, usdRate, type Level } from "@/lib/stats";

export const dynamic = "force-dynamic";

// Read-only MCP server (streamable HTTP, stateless, plain JSON replies). Auth: ?key= or "Authorization: Bearer".
// shortcut: no SSE or sessions; enough for Claude Code, add if a client needs streaming.
const PERIOD = { type: "string", enum: ["hoy", "ayer", "7d", "30d", "todo", "custom"], description: "Período (default hoy). custom usa desde/hasta." };
const COMMON = {
  periodo: PERIOD,
  desde: { type: "string", description: "YYYY-MM-DD (periodo=custom)" },
  hasta: { type: "string", description: "YYYY-MM-DD inclusive (periodo=custom)" },
  modelo: { type: "string", enum: ["last_touch", "first_touch"], description: "Atribución (default last_touch)" },
  dashboard: { type: "string", description: "Nombre o id de cuenta del dashboard (default: el primero)" },
};
const obj = (properties: object) => ({ type: "object", properties: { ...COMMON, ...properties } });

const TOOLS = [
  { name: "dashboards", description: "Lista los dashboards (cuentas publicitarias) y la cotización del dólar cargada.", inputSchema: { type: "object", properties: {} } },
  { name: "resumen", description: "KPIs del período: gasto Meta (USD), facturación bruta y neta (USD), ventas por estado, ROAS, por método de pago, fuente y producto.", inputSchema: obj({}) },
  { name: "por_dia", description: "Gasto y facturación (USD) por día (por semana si el rango supera 92 días).", inputSchema: obj({ base: { type: "string", enum: ["bruta", "neta"] } }) },
  { name: "campanas", description: "Filas por campaña, conjunto o anuncio con gasto, ventas, ingresos, ganancia, ROAS, clics.", inputSchema: obj({ nivel: { type: "string", enum: ["campaign", "adset", "ad"] } }) },
  { name: "ventas", description: "Últimas ventas del período con producto, método, atribución y monto en USD.", inputSchema: obj({ limite: { type: "number", description: "Máximo de filas (default 50, tope 500)" } }) },
];

type A = Record<string, string | number | undefined>;

function run(name: string, a: A): unknown {
  const pid = getProject().id;
  const list = dashboards(pid);
  if (name === "dashboards") return { dashboards: list, dolar: usdRate(pid) };
  const want = String(a.dashboard ?? "").toLowerCase();
  const dash = (want && list.find((d) => d.name.toLowerCase() === want || d.ad_account_id.toLowerCase() === want || d.ad_account_id.toLowerCase() === `act_${want}`)) || list[0];
  if (!dash) throw new Error("No hay dashboards");
  const p = asPeriod(a.periodo as string);
  const m = asModel(a.modelo as string);
  const { from, to } = range(p, a.desde as string, a.hasta as string);
  const acc = dash.ad_account_id;
  const meta = { dashboard: dash.name, periodo: p, modelo: m, moneda: "USD (ventas ARS convertidas con el dólar cargado)" };
  if (name === "resumen") {
    const o = overview(pid, from, to, m, acc);
    return { ...meta, ...o, roas_bruto: o.spend.spend ? o.k.rev / o.spend.spend : null, roas_neto: o.spend.spend ? o.k.net / o.spend.spend : null };
  }
  if (name === "por_dia") return { ...meta, dias: daily(pid, from, to, m, acc, a.base === "neta" ? "neta" : "bruta") };
  if (name === "campanas") {
    const level = (["campaign", "adset", "ad"].includes(String(a.nivel)) ? a.nivel : "campaign") as Level;
    return { ...meta, nivel: level, filas: byLevel(pid, from, to, m, level, acc) };
  }
  if (name === "ventas") return { ...meta, ventas: sales(pid, from, to, m, acc, Math.min(Math.max(Number(a.limite) || 50, 1), 500)) };
  throw new Error(`Herramienta desconocida: ${name}`);
}

function authorized(req: NextRequest): boolean {
  const given = req.nextUrl.searchParams.get("key") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(given), b = Buffer.from(mcpKey());
  return a.length === b.length && timingSafeEqual(a, b);
}

const ok = (id: unknown, result: unknown) => ({ jsonrpc: "2.0", id, result });
const fail = (id: unknown, code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });

function handle(msg: { id?: unknown; method?: string; params?: { name?: string; arguments?: A } }) {
  const { id, method } = msg;
  if (id === undefined) return null; // notification
  if (method === "initialize")
    return ok(id, { protocolVersion: "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "attribution", version: "1.0.0" } });
  if (method === "ping") return ok(id, {});
  if (method === "tools/list") return ok(id, { tools: TOOLS });
  if (method === "tools/call") {
    try {
      const out = run(String(msg.params?.name), msg.params?.arguments ?? {});
      return ok(id, { content: [{ type: "text", text: JSON.stringify(out) }] });
    } catch (e) {
      return ok(id, { isError: true, content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }] });
    }
  }
  return fail(id, -32601, "Method not found");
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return new NextResponse("Unauthorized", { status: 401 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json(fail(null, -32700, "Parse error"), { status: 400 }); }
  if (Array.isArray(body)) {
    const out = body.map(handle).filter(Boolean);
    return out.length ? NextResponse.json(out) : new NextResponse(null, { status: 202 });
  }
  const out = handle(body as Parameters<typeof handle>[0]);
  return out ? NextResponse.json(out) : new NextResponse(null, { status: 202 });
}

// Streamable HTTP clients may probe with GET for a server-sent stream; we don't offer one.
export const GET = () => new NextResponse(null, { status: 405 });
