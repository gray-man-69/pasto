import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "Pasto — Italian macro tracker",
  description:
    "Track your macros against your goals using reliable Italian (CREA) nutritional values.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Pasto", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" data-theme="pasto">
      <body className="min-h-screen bg-base-200 antialiased">
        <main className="mx-auto w-full max-w-md px-4 pt-4">{children}</main>
        <BottomNav />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
