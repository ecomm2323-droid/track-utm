"use client";

import { useState } from "react";
import { CopyButton } from "@/components/copy-button";

// Meta dynamic macros go in the ad-level "URL Parameters" field. Ids are packed as Name|id so they survive
// checkouts that only keep standard UTMs (Impultienda, Hotmart...); same format UTMify uses.
const META_PARAMS =
  "utm_source=FB&utm_campaign={{campaign.name}}|{{campaign.id}}&utm_medium={{adset.name}}|{{adset.id}}&utm_content={{ad.name}}|{{ad.id}}&utm_term={{placement}}";

const input = "w-full bg-bg border border-line rounded px-3 py-2 outline-none focus:border-accent";

export function UtmBuilder() {
  const [f, setF] = useState({ url: "", utm_source: "", utm_medium: "", utm_campaign: "", utm_content: "", utm_term: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  let organic = "";
  if (f.url && f.utm_source) {
    try {
      const u = new URL(/^https?:\/\//.test(f.url) ? f.url : "https://" + f.url);
      for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const) {
        if (f[k]) u.searchParams.set(k, f[k]);
      }
      organic = u.toString();
    } catch {
      organic = "";
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-3">
      <section className="bg-panel border border-line rounded-lg p-4">
        <h2 className="font-medium mb-1">Anuncios de Meta</h2>
        <p className="text-muted text-xs mb-3">
          En Ads Manager: editá el anuncio → <b>Seguimiento</b> → <b>Parámetros de URL</b>, y pegá esto (a nivel anuncio, no campaña).
        </p>
        <div className="flex gap-2 items-start">
          <code className="flex-1 bg-bg border border-line rounded p-3 font-mono text-xs break-all">{META_PARAMS}</code>
          <CopyButton text={META_PARAMS} />
        </div>
        <p className="text-muted text-xs mt-3">
          Sin esto Meta solo manda <code>fbclid</code> y no se puede saber qué anuncio vendió. Los ids van pegados al nombre (<code>Nombre|id</code>) para que lleguen aunque tu checkout guarde solo UTMs estándar.
        </p>
      </section>

      <section className="bg-panel border border-line rounded-lg p-4">
        <h2 className="font-medium mb-3">UTMs orgánicas</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 text-xs text-muted">Link de la URL
            <input className={input} placeholder="https://tusitio.com" value={f.url} onChange={set("url")} />
          </label>
          <label className="text-xs text-muted">utm_source *
            <input className={input} placeholder="bio" value={f.utm_source} onChange={set("utm_source")} />
          </label>
          <label className="text-xs text-muted">utm_medium
            <input className={input} placeholder="instagram" value={f.utm_medium} onChange={set("utm_medium")} />
          </label>
          <label className="text-xs text-muted">utm_campaign
            <input className={input} placeholder="perfil" value={f.utm_campaign} onChange={set("utm_campaign")} />
          </label>
          <label className="text-xs text-muted">utm_content
            <input className={input} placeholder="link-bio" value={f.utm_content} onChange={set("utm_content")} />
          </label>
          <label className="col-span-2 text-xs text-muted">utm_term
            <input className={input} placeholder="promo" value={f.utm_term} onChange={set("utm_term")} />
          </label>
        </div>
        <div className="flex gap-2 items-center mt-3">
          <input readOnly className={input} placeholder="La URL generada aparecerá aquí" value={organic} />
          {organic && <CopyButton text={organic} />}
        </div>
      </section>
    </div>
  );
}
