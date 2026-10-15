import Link from "next/link";

// Shows which ad account the page is scoped to; points to Dashboards when there is none.
export function DashboardNotice({ name, account }: { name?: string; account?: string }) {
  if (!account) {
    return (
      <p className="text-sm text-muted mb-4">
        No hay dashboards. <Link href="/dashboards" className="underline text-white">Creá uno con tu cuenta publicitaria</Link>.
      </p>
    );
  }
  return (
    <p className="text-xs text-muted mb-4">
      Dashboard: <span className="text-white">{name}</span> · {account} ·{" "}
      <Link href="/dashboards" className="underline">cambiar</Link>
    </p>
  );
}
