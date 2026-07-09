"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isActive } from "./navItems";

// Desktop-only left sidebar. Replaces the bottom tab bar at lg+ so the app reads
// as a desktop dashboard, not a phone column.
export default function SideNav() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-base-300 bg-base-100 lg:flex">
      <Link href="/" className="flex items-center justify-center gap-2 px-6 py-6">
        <span className="text-xl font-bold tracking-tight">Pasto</span>
        <span className="h-2 w-2 rounded-full bg-primary" />
      </Link>
      <nav className="flex flex-col gap-1 px-3">
        {NAV_ITEMS.map((tab) => {
          const active = isActive(tab.href, pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-primary/10 text-primary"
                  : "text-base-content/60 hover:bg-base-300/40 hover:text-base-content"
              }`}
            >
              <span className="grid h-6 w-6 place-items-center">{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto px-6 py-5 text-xs leading-relaxed text-base-content/30">
        Local-first · offline
        <br />
        CREA nutrition data
      </div>
    </aside>
  );
}
