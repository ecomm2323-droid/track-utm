"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Dash = { id: number; name: string; ad_account_id: string };

const NAV: { href: string; label: string; icon: string }[] = [
  { href: "/", label: "Resumen", icon: "◧" },
  { href: "/campanas", label: "Meta", icon: "◎" },
  { href: "/ventas", label: "Ventas", icon: "$" },
  { href: "/utms", label: "UTMs", icon: "⌗" },
  { href: "/integraciones", label: "Integraciones", icon: "⇄" },
  { href: "/dashboards", label: "Dashboards", icon: "▦" },
  { href: "/ajustes", label: "Ajustes", icon: "⚙" },
  { href: "/tutorial", label: "Tutorial", icon: "?" },
];

export function Sidebar({ dashes, active }: { dashes: Dash[]; active?: number }) {
  const path = usePathname();
  const [open, setOpen] = useState(false); // mobile drawer
  useEffect(() => setOpen(false), [path]);
  if (path === "/login") return null;
  const cur = dashes.find((d) => d.id === active);
  return (
    <>
      <header className="md:hidden fixed top-0 inset-x-0 z-30 h-14 px-4 flex items-center gap-3 glass rounded-none border-x-0 border-t-0">
        <button
          type="button"
          aria-label="Abrir menú"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="h-11 w-11 -ml-2 grid place-items-center rounded-lg text-xl hover:bg-white/10"
        >
          ☰
        </button>
        <span className="font-semibold"><span className="text-accent">●</span> Attribution</span>
        <span className="ml-auto text-xs text-muted truncate max-w-[40%]">{cur?.name}</span>
      </header>
      {open && <div className="md:hidden fixed inset-0 z-30 bg-black/60" onClick={() => setOpen(false)} aria-hidden />}
      <aside
        className={`glass w-64 md:w-56 shrink-0 p-3 flex flex-col rounded-none border-y-0 border-l-0 fixed inset-y-0 left-0 z-40 h-screen
          transition-transform duration-200 md:sticky md:top-0 md:translate-x-0 ${open ? "translate-x-0 bg-bg!" : "-translate-x-full"}`}
      >
        <div className="px-2 py-3 mb-1 text-base font-semibold tracking-tight flex items-center">
          <span><span className="text-accent">●</span> Attribution</span>
          <button type="button" aria-label="Cerrar menú" onClick={() => setOpen(false)} className="md:hidden ml-auto h-11 w-11 -mr-2 grid place-items-center rounded-lg hover:bg-white/10">✕</button>
        </div>
        <details className="relative mb-3 group">
          <summary className="glass rounded-lg px-3 py-2 min-h-11 cursor-pointer list-none flex items-center justify-between hover:border-accent/50">
            <span className="truncate">
              <span className="block text-[11px] uppercase tracking-wide text-muted">Dashboard</span>
              {cur?.name ?? "Sin dashboards"}
            </span>
            <span className="text-muted group-open:rotate-180 transition-transform">⌄</span>
          </summary>
          <div className="glass absolute z-50 mt-1 w-full rounded-lg p-1 bg-bg!">
            {dashes.map((d) => (
              <a key={d.id} href={`/dashboards/activate?id=${d.id}`} className={`block rounded px-3 py-2.5 hover:bg-white/10 ${d.id === active ? "text-accent" : ""}`}>
                {d.name}
              </a>
            ))}
            <Link href="/dashboards" className="block rounded px-3 py-2.5 text-muted hover:text-white hover:bg-white/10">+ Gestionar</Link>
          </div>
        </details>
        <nav className="flex flex-col gap-0.5" aria-label="Principal">
          {NAV.map((n) => {
            const on = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={on ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 border-l-2 ${on ? "border-accent bg-accent/15 text-white" : "border-transparent text-muted hover:text-white hover:bg-white/5"}`}
              >
                <span aria-hidden className={`w-4 text-center ${on ? "text-cyan" : ""}`}>{n.icon}</span>{n.label}
              </Link>
            );
          })}
        </nav>
        <a href="/logout" className="mt-auto px-3 py-3 text-sm text-muted hover:text-white">Salir</a>
      </aside>
    </>
  );
}
