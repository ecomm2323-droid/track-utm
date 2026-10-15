import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { getProject } from "@/lib/db";
import { dashboards } from "@/lib/dashboards";
import { tokenDaysLeft } from "@/lib/meta";
import { TokenNotice } from "@/components/token-notice";
import { activeDashboard } from "@/lib/active-dashboard";

export const metadata: Metadata = {
  title: { default: "Attribution", template: "%s · Attribution" },
  description: "Ad attribution and tracking",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const dashes = dashboards(getProject().id).map((d) => ({ id: d.id, name: d.name, ad_account_id: d.ad_account_id })); // sqlite rows are null-prototype; client props must be plain
  const active = (await activeDashboard())?.id;
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex font-sans text-sm">
        <Sidebar dashes={dashes} active={active} />
        <main className="flex-1 min-w-0 p-4 md:p-6"><TokenNotice days={tokenDaysLeft()} />{children}</main>
      </body>
    </html>
  );
}
