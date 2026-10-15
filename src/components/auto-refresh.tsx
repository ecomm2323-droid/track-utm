"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-renders the server page so new sales and synced spend show up without reloading. Skips hidden tabs.
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
