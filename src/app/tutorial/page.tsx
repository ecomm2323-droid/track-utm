import Link from "next/link";
import { headers } from "next/headers";
import { getProject, q1 } from "@/lib/db";
import { Card } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";

export const metadata = { title: "Tutorial" };
export const dynamic = "force-dynamic";

const UTMS =
  "utm_source=FB&utm_campaign={{campaign.name}}|{{campaign.id}}&utm_medium={{adset.name}}|{{adset.id}}&utm_content={{ad.name}}|{{ad.id}}&utm_term={{placement}}";

function Code({ text }: { text: string }) {
  return (
    <div className="flex gap-2 items-start my-2">
      <pre className="flex-1 bg-bg border border-line rounded p-3 font-mono text-xs whitespace-pre-wrap break-all">{text}</pre>
      <CopyButton text={text} />
    </div>
  );
}

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="list-decimal pl-5 space-y-3 [&_li]:pl-1 [&_b]:text-white">{children}</ol>;
}

const GLOSS: [string, string][] = [
  ["Pixel (script de seguimiento)", "Un pedacito de código que pegás en tu página. Anota de qué anuncio llegó cada visitante, como un portero que apunta de dónde viene cada persona."],
  ["Webhook", "Un aviso automático. Cuando Impultienda cobra una venta, le manda un mensaje a esta herramienta con el monto y el producto. Vos pegás una dirección (URL) y listo."],
  ["UTM", "Etiquetas al final del link de tu anuncio (utm_campaign=…). Dicen de qué campaña, conjunto y anuncio vino el clic."],
  ["Atribución", "Unir una venta con el anuncio que la trajo. Sin UTM ni pixel, la venta entra como “Sin atribución”."],
  ["ID de cuenta publicitaria", "El número de tu cuenta de anuncios de Meta. Empieza con act_ o es solo un número."],
  ["Token", "Una llave que Meta le da a esta herramienta para leer tus gastos. Dura unos 60 días y se renueva sola mientras la herramienta siga funcionando."],
];

export default async function Tutorial() {
  const project = getProject();
  const h = await headers();
  const base = process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
  const hook = q1<{ token: string }>("select token from webhook where project_id=? and platform='impultienda' order by id limit 1", project.id);
  const hookUrl = hook ? `${base}/api/webhooks/impultienda?token=${hook.token}` : null;
  const pixel = `<script async src="${base}/tracker.js" data-key="${project.public_key}" data-decorate="TU-CHECKOUT.impultienda.com"></script>`;

  return (
    <>
      <h1 className="text-lg font-semibold mb-1">Tutorial de conexión</h1>
      <p className="text-muted mb-4">Tres conexiones, en este orden: Meta (gastos), Impultienda (ventas) y el pixel (de qué anuncio viene cada venta). Tarda unos 15 minutos.</p>

      <div className="space-y-3 max-w-3xl">
        <Card title="Palabras que vas a ver">
          <dl className="space-y-2">
            {GLOSS.map(([t, d]) => (
              <div key={t}>
                <dt className="font-semibold text-white">{t}</dt>
                <dd className="text-muted">{d}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card title="1 · Conectar Meta (para traer los gastos)">
          <Steps>
            <li>Andá a <Link href="/ajustes" className="underline text-accent">Ajustes</Link> y tocá <b>Conectar / reconectar con Meta</b>.</li>
            <li>Se abre Facebook. Entrá con la cuenta que administra tus anuncios y aceptá los permisos (solo pide <i>leer</i> anuncios, no puede publicar ni gastar).</li>
            <li>Volvés a esta herramienta. En Ajustes, abajo, tiene que decir <b>token vigente</b>.</li>
            <li>
              Buscá el <b>ID de tu cuenta publicitaria</b>: entrá al Administrador de anuncios de Meta (adsmanager.facebook.com). Arriba a la izquierda, junto al nombre de la cuenta, aparece un número. Copialo.
            </li>
            <li>Andá a <Link href="/dashboards" className="underline text-accent">Dashboards</Link>, escribí un nombre, pegá el ID y tocá <b>Crear</b>.</li>
            <li>En <Link href="/" className="underline text-accent">Resumen</Link> tocá <b>Sincronizar Meta</b>. En la pestaña <Link href="/campanas" className="underline text-accent">Meta</Link> tienen que aparecer tus campañas con su gasto.</li>
          </Steps>
          <p className="text-xs text-muted mt-3">Si no aparece nada: revisá que el ID sea el de la cuenta correcta y que elijas “Hoy” o “30 días” arriba.</p>
        </Card>

        <Card title="2 · Conectar Impultienda (para traer las ventas)">
          <Steps>
            <li>
              Acá, andá a <Link href="/integraciones?tab=webhooks" className="underline text-accent">Integraciones → Webhooks</Link>, elegí <b>impultienda</b> y tocá <b>Agregar webhook</b>. Te da una dirección (URL) personal.
              {hookUrl ? <Code text={hookUrl} /> : <span className="block text-muted text-xs mt-1">(Todavía no creaste uno: al crearlo, la URL aparece ahí y la copiás con el botón.)</span>}
            </li>
            <li>En Impultienda: <b>Configuraciones → Webhooks → Agregar endpoint</b> (requiere el plan Max).</li>
            <li>Pegá la URL del paso 1.</li>
            <li>Marcá estos eventos: <code>order.created</code>, <code>order.approved</code>, <code>order.refunded</code>, <code>order.chargeback</code>, <code>order.rejected</code>. Guardá.</li>
            <li>Hacé una compra de prueba (o esperá una real) y mirá <Link href="/integraciones?tab=pruebas" className="underline text-accent">Integraciones → Pruebas</Link>: tiene que aparecer una línea verde <b>OK</b>.</li>
          </Steps>
          <p className="text-xs text-muted mt-3">La URL tiene que ser pública (la de Railway), no “localhost”. Una venta real tarda segundos en verse en Resumen.</p>
        </Card>

        <Card title="3 · Pixel y UTMs (para saber de qué anuncio vino cada venta)">
          <p className="text-muted mb-2">Sin esto las ventas se cuentan igual, pero como “Sin atribución”. Son dos cosas:</p>
          <Steps>
            <li>
              <b>Pegar el pixel</b> en el <code>&lt;head&gt;</code> de tu landing y de tu checkout. Cambiá <code>TU-CHECKOUT.impultienda.com</code> por el dominio de tu checkout, así la venta no pierde el anuncio al cambiar de página:
              <Code text={pixel} />
            </li>
            <li>
              <b>Poner los UTMs en tus anuncios</b>: en Meta, al editar el anuncio, bajá hasta <i>Parámetros de URL</i> y pegá esto:
              <Code text={UTMS} />
              Meta reemplaza solo las partes entre llaves por el nombre y el ID reales de cada anuncio.
            </li>
            <li>Hacé clic en uno de tus anuncios y mirá <Link href="/integraciones?tab=pruebas" className="underline text-accent">Integraciones → Pruebas → Últimos clics</Link>: tiene que aparecer el clic con su campaña.</li>
          </Steps>
        </Card>

        <Card title="Cómo saber que todo anda">
          <ul className="list-disc pl-5 space-y-1 text-muted">
            <li>Meta: ves campañas con gasto en la pestaña Meta.</li>
            <li>Impultienda: aparece “OK” en Pruebas después de una compra.</li>
            <li>Pixel: ves tu clic en “Últimos clics rastreados”.</li>
            <li>Dólar: cargá la cotización y lo que te queda por producto en <Link href="/ajustes" className="underline text-accent">Ajustes</Link> para que el ROAS y la ganancia estén bien.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
