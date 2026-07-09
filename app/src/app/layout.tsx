import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import SideNav from "@/components/SideNav";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { BASE_PATH } from "@/lib/basePath";

export const metadata: Metadata = {
  title: "Pasto — Italian macro tracker",
  description:
    "Track your macros against your goals using reliable Italian (CREA) nutritional values.",
  manifest: `${BASE_PATH}/manifest.json`,
  appleWebApp: { capable: true, title: "Pasto", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0c0d10",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" data-theme="pasto">
      <body className="antialiased" suppressHydrationWarning>
        {/* App shell: sidebar + content on desktop, single column + bottom tab
            bar on phones. The content area owns the scroll. */}
        <div className="flex h-dvh w-full overflow-hidden bg-base-200 text-base-content">
          <SideNav />
          <div className="flex min-w-0 flex-1 flex-col">
            <main className="app-glow flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-10 lg:py-8">
                {children}
              </div>
            </main>
            <BottomNav />
          </div>
        </div>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
