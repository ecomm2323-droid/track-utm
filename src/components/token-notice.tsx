"use client";

import { usePathname } from "next/navigation";

// Warns when the Meta connection is about to stop (auto-renewal failed) or already has.
export function TokenNotice({ days }: { days?: number }) {
  if (usePathname() === "/login" || days === undefined || days > 7) return null;
  return (
    <a href="/api/meta/connect" className="block mb-4 rounded-lg border border-bad/50 bg-bad/10 px-3 py-2 text-bad">
      {days < 0 ? "La conexión con Meta venció: el gasto ya no se actualiza." : `La conexión con Meta vence en ${days} día(s).`} Tocá acá para reconectar.
    </a>
  );
}
