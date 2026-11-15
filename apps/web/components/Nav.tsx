"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS: Array<[string, string]> = [
  ["/dashboard", "Dashboard"],
  ["/problems", "Problems"],
  ["/patterns", "Patterns"],
  ["/lists", "Lists"],
  ["/plan", "Plan"],
  ["/clues", "Clues"],
  ["/settings", "Settings"],
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Main">
      {LINKS.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={path === href || path.startsWith(`${href}/`) ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
