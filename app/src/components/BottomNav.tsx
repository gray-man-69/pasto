"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isActive } from "./navItems";

// Phone-only bottom tab bar. On desktop the SideNav takes over (this hides).
export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="flex h-[4.25rem] shrink-0 items-stretch border-t border-base-300 bg-base-100/90 px-4 backdrop-blur-lg lg:hidden">
      {NAV_ITEMS.map((tab) => {
        const active = isActive(tab.href, pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-1 flex-col items-center justify-center gap-1 text-[11px] transition-colors ${
              active ? "font-semibold text-primary" : "text-base-content/50 hover:text-base-content/80"
            }`}
          >
            <span className="grid h-6 w-6 place-items-center [&>svg]:h-5 [&>svg]:w-5">{tab.icon}</span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
