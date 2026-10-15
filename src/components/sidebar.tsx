"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Resumen" },
  { href: "/dashboards", label: "Dashboards" },
  { href: "/campanas", label: "Campañas" },
  { href: "/ventas", label: "Ventas" },
  { href: "/utms", label: "UTMs" },
  { href: "/integraciones", label: "Integraciones" },
];

export function Sidebar() {
  const path = usePathname();
  if (path === "/login") return null;
  return (
    <aside className="w-44 shrink-0 bg-side border-r border-line min-h-screen p-3 hidden sm:block">
      <div className="px-2 py-3 mb-2 text-base font-semibold tracking-tight">Attribution</div>
      <nav className="flex flex-col gap-1">
        {NAV.map((n) => {
          const on = n.href === "/" ? path === "/" : path.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded px-3 py-2 ${on ? "bg-accent text-white" : "text-muted hover:text-white hover:bg-panel"}`}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>
      <a href="/logout" className="block mt-4 px-3 py-2 text-xs text-muted hover:text-white">Salir</a>
    </aside>
  );
}
