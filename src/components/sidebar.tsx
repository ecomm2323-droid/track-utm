"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Dash = { id: number; name: string; ad_account_id: string };

// Tree from the approved mockup; entries without href are placeholders for features not built yet.
const NAV: { href?: string; label: string; icon: string }[] = [
  { href: "/", label: "Resumen", icon: "◧" },
  { href: "/campanas", label: "Meta", icon: "◎" },
  { href: "/ventas", label: "Ventas", icon: "$" },
  { href: "/utms", label: "UTMs", icon: "⌗" },
  { label: "Informes", icon: "▤" },
  { label: "Gastos", icon: "↧" },
  { label: "Tarifas", icon: "%" },
  { href: "/integraciones", label: "Integraciones", icon: "⇄" },
  { href: "/dashboards", label: "Dashboards", icon: "▦" },
  { href: "/ajustes", label: "Ajustes", icon: "⚙" },
];

export function Sidebar({ dashes, active }: { dashes: Dash[]; active?: number }) {
  const path = usePathname();
  if (path === "/login") return null;
  const cur = dashes.find((d) => d.id === active);
  return (
    <aside className="glass w-56 shrink-0 min-h-screen p-3 hidden md:flex flex-col rounded-none border-y-0 border-l-0 sticky top-0 h-screen">
      <div className="px-2 py-3 mb-1 text-base font-semibold tracking-tight">
        <span className="text-accent">●</span> Attribution
      </div>
      <details className="relative mb-3 group">
        <summary className="glass rounded-lg px-3 py-2 cursor-pointer list-none flex items-center justify-between hover:border-accent/50">
          <span className="truncate">
            <span className="block text-[10px] uppercase tracking-wide text-muted">Dashboard</span>
            {cur?.name ?? "Sin dashboards"}
          </span>
          <span className="text-muted group-open:rotate-180 transition-transform">⌄</span>
        </summary>
        <div className="glass absolute z-30 mt-1 w-full rounded-lg p-1 bg-bg/95">
          {dashes.map((d) => (
            <a key={d.id} href={`/dashboards/activate?id=${d.id}`} className={`block rounded px-3 py-1.5 hover:bg-white/10 ${d.id === active ? "text-accent" : ""}`}>
              {d.name}
            </a>
          ))}
          <Link href="/dashboards" className="block rounded px-3 py-1.5 text-muted hover:text-white hover:bg-white/10">+ Gestionar</Link>
        </div>
      </details>
      <nav className="flex flex-col gap-0.5">
        {NAV.map((n) => {
          const on = n.href ? (n.href === "/" ? path === "/" : path.startsWith(n.href)) : false;
          const cls = "flex items-center gap-3 rounded-lg px-3 py-2 border-l-2";
          if (!n.href)
            return (
              <span key={n.label} className={`${cls} border-transparent text-muted/50 cursor-not-allowed`}>
                <span className="w-4 text-center">{n.icon}</span>{n.label}
                <span className="ml-auto text-[10px] rounded bg-white/10 px-1.5 py-0.5">Pronto</span>
              </span>
            );
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`${cls} ${on ? "border-accent bg-accent/15 text-white" : "border-transparent text-muted hover:text-white hover:bg-white/5"}`}
            >
              <span className={`w-4 text-center ${on ? "text-cyan" : ""}`}>{n.icon}</span>{n.label}
            </Link>
          );
        })}
      </nav>
      <a href="/logout" className="mt-auto px-3 py-2 text-xs text-muted hover:text-white">Salir</a>
    </aside>
  );
}
