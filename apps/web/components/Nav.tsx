"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@leettrack/ui/lib/utils";

const LINKS: Array<[string, string]> = [
  ["/dashboard", "Dashboard"],
  ["/problems", "Problems"],
  ["/patterns", "Patterns"],
  ["/lists", "Lists"],
  ["/plan", "Plan"],
  ["/clues", "Clues"],
  ["/settings", "Settings"],
];

/** LeetCode-style tabs: the current page underlined in orange. Scrolls sideways on phones. */
export function Nav() {
  const path = usePathname();
  return (
    <nav
      className="-mb-px flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none]"
      aria-label="Main"
    >
      {LINKS.map(([href, label]) => {
        const current = path === href || path.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "shrink-0 border-b-2 border-transparent px-2.5 py-3.5 text-sm text-muted-foreground no-underline transition-colors hover:text-foreground hover:no-underline",
              current && "border-primary font-medium text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
