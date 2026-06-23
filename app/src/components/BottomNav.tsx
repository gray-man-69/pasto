"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Today", icon: "🍽️" },
  { href: "/week", label: "Week", icon: "📅" },
  { href: "/add", label: "Add", icon: "➕" },
  { href: "/goals", label: "Goals", icon: "🎯" },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex h-16 max-w-md border-t border-base-300 bg-base-100">
      {TABS.map((tab) => {
        const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-xs ${
              active ? "text-primary font-semibold" : "text-base-content/60"
            }`}
          >
            <span className="text-xl leading-none">{tab.icon}</span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
