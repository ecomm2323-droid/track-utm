import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";

export const metadata: Metadata = {
  title: "Attribution",
  description: "Ad attribution and tracking",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex font-sans text-sm">
        <Sidebar />
        <main className="flex-1 min-w-0 p-4 md:p-6">{children}</main>
      </body>
    </html>
  );
}
