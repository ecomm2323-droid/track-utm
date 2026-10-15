"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Re-renders the server page so new sales and synced spend show up without reloading. Skips hidden tabs.
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  const [last, setLast] = useState<Date | null>(null);
  useEffect(() => {
    setLast(new Date());
    const t = setInterval(() => {
      if (document.hidden) return;
      router.refresh();
      setLast(new Date());
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return (
    <div role="status" className="fixed bottom-3 right-3 z-20 glass rounded-full px-3 py-1.5 text-xs text-muted flex items-center gap-2 pointer-events-none">
      <span aria-hidden className="h-2 w-2 rounded-full bg-good animate-pulse" />
      En vivo{last ? ` · ${last.toLocaleTimeString("es-AR")}` : ""}
    </div>
  );
}
