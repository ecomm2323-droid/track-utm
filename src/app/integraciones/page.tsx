import Link from "next/link";
import { headers } from "next/headers";
import { getProject, q } from "@/lib/db";
import { PLATFORMS } from "@/lib/webhooks";
import { Card, td, th } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { CopyButton } from "@/components/copy-button";
import { createWebhook, deleteWebhook } from "./actions";

export const metadata = { title: "Integraciones" };
export const dynamic = "force-dynamic";

const TABS = { tracker: "Tracker", webhooks: "Webhooks", pruebas: "Pruebas" } as const;
type Tab = keyof typeof TABS;

const field = "bg-bg border border-line rounded px-3 py-2 outline-none focus:border-accent";

function Code({ text }: { text: string }) {
  return (
    <div className="flex gap-2 items-start">
      <pre className="flex-1 bg-bg border border-line rounded p-3 font-mono text-xs whitespace-pre-wrap break-all">{text}</pre>
      <CopyButton text={text} />
    </div>
  );
}

export default async function Integraciones({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: t } = await searchParams;
  const tab: Tab = t === "webhooks" || t === "pruebas" ? t : "tracker";
  const project = getProject();
  const h = await headers();
  const base =
    process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;

  return (
    <>
      <h1 className="text-lg font-semibold mb-4">Integraciones</h1>
      <div className="flex gap-2 mb-4">
        {(Object.keys(TABS) as Tab[]).map((k) => (
          <Link
            key={k}
            href={`/integraciones?tab=${k}`}
            className={`px-4 py-2 rounded border ${k === tab ? "border-accent bg-panel" : "border-line text-muted"}`}
          >
            {TABS[k]}
          </Link>
        ))}
        <span className="px-4 py-2 rounded border border-line text-muted/50" title="Etapa 5">Meta Ads (próximamente)</span>
      </div>

      {tab === "tracker" && (
        <div className="space-y-3">
          <Card title="1 · Script de tracking (en landing y checkout)">
            <p className="text-muted text-xs mb-3">
              Pegalo en el <code>&lt;head&gt;</code>. Captura UTMs y <code>fbclid</code>. Con <code>data-decorate</code> agrega
              el id de visitante y los UTMs a los links que salen hacia tu checkout, así la venta se atribuye aunque el pago ocurra en otro dominio.
            </p>
            <Code
              text={`<script async src="${base}/tracker.js" data-key="${project.public_key}" data-decorate="pay.tucheckout.com"></script>`}
            />
          </Card>
          <Card title="2 · Evento de compra desde la página de gracias (opcional)">
            <Code text={`<script>utmify.track('purchase', { order_id: 'ORDER123', value: 47.0, currency: 'USD' })</script>`} />
          </Card>
          <Card title="Consentimiento">
            <p className="text-muted text-xs">
              <code>window.utConsent = false</code> antes del script (o <code>utmify.consent(true)</code> después) para frenar cookies y envíos hasta que el visitante acepte.
            </p>
          </Card>
        </div>
      )}

      {tab === "webhooks" && <Webhooks base={base} projectId={project.id} />}
      {tab === "pruebas" && <Pruebas projectId={project.id} />}
    </>
  );
}

function Webhooks({ base, projectId }: { base: string; projectId: number }) {
  const hooks = q<{ id: number; platform: string; name: string; token: string }>(
    "select id, platform, name, token from webhook where project_id=? order by id desc",
    projectId,
  );
  return (
    <div className="space-y-3">
      <Card title="Agregar webhook">
        <form action={createWebhook} className="flex flex-wrap gap-2">
          <select name="platform" className={field}>
            {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <input name="name" aria-label="Nombre del webhook" placeholder="Nombre (opcional)" className={field} />
          <button className="px-4 py-2 rounded bg-accent text-white">Agregar webhook</button>
        </form>
        <p className="text-muted text-xs mt-3">
          Pegá la URL en la sección de webhooks/postback de tu plataforma de ventas. Después revisá la pestaña Pruebas para confirmar que el valor y el estado se leen bien.
        </p>
        <p className="text-muted text-xs mt-2">
          <b>Impultienda</b> (plan Max): Configuraciones → Webhooks → Agregar endpoint. Eventos: order.created, order.approved, order.refunded, order.chargeback, order.rejected. La URL tiene que ser pública (no localhost).
        </p>
      </Card>
      {hooks.map((w) => {
        const url = `${base}/api/webhooks/${w.platform}?token=${w.token}`;
        return (
          <Card key={w.id} title={`${w.platform} · ${w.name}`}>
            <Code text={url} />
            <form action={deleteWebhook} className="mt-3">
              <input type="hidden" name="id" value={w.id} />
              <ConfirmButton message="¿Eliminar este webhook? Las ventas dejarán de llegar por esta URL." className="text-bad text-xs underline py-2">Eliminar</ConfirmButton>
            </form>
          </Card>
        );
      })}
      {!hooks.length && <p className="text-muted">Todavía no hay webhooks.</p>}
    </div>
  );
}

function Pruebas({ projectId }: { projectId: number }) {
  const logs = q<{ id: number; ts: number; platform: string; ok: number; note: string; body: string }>(
    "select id, ts, platform, ok, note, body from webhook_log where project_id=? order by id desc limit 20",
    projectId,
  );
  const touches = q<{ ts: number; channel: string; campaign: string | null; ad_id: string | null; landing_url: string | null }>(
    "select ts, channel, campaign, ad_id, landing_url from touch where project_id=? order by id desc limit 10",
    projectId,
  );
  const when = (ts: number) => new Date(ts).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "medium" });
  return (
    <div className="space-y-3">
      <Card title="Últimos clics rastreados" className="overflow-x-auto p-0">
        <table className="w-full">
          <thead><tr>{["Fecha", "Canal", "Campaña", "Ad ID", "Landing"].map((x) => <th key={x} className={th}>{x}</th>)}</tr></thead>
          <tbody>
            {touches.map((r, i) => (
              <tr key={i}>
                <td className={td}>{when(r.ts)}</td><td className={td}>{r.channel}</td>
                <td className={td}>{r.campaign ?? "—"}</td><td className={`${td} font-mono`}>{r.ad_id ?? "—"}</td>
                <td className={`${td} max-w-xs truncate`}>{r.landing_url ?? "—"}</td>
              </tr>
            ))}
            {!touches.length && <tr><td className={`${td} text-muted`} colSpan={5}>Todavía no llegó ningún clic. Instalá el script y visitá tu landing con UTMs.</td></tr>}
          </tbody>
        </table>
      </Card>
      <Card title="Últimos webhooks recibidos (payload crudo)">
        {logs.map((l) => (
          <details key={l.id} className="border-b border-line/60 py-2">
            <summary className="cursor-pointer">
              <span className={l.ok ? "text-good" : "text-bad"}>{l.ok ? "OK" : "ERROR"}</span> · {when(l.ts)} · {l.platform} · <span className="text-muted">{l.note}</span>
            </summary>
            <pre className="bg-bg border border-line rounded p-3 mt-2 text-xs overflow-x-auto">{l.body}</pre>
          </details>
        ))}
        {!logs.length && <p className="text-muted">Sin webhooks todavía.</p>}
      </Card>
    </div>
  );
}
