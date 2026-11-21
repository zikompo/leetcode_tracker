import { Term } from "@leettrack/ui/components/term";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { QueueItem } from "@leettrack/core";
import { Badge } from "@leettrack/ui/components/badge";
import { Difficulty } from "@leettrack/ui/components/panel";
import { leetcodeUrl } from "@/lib/util";

/** Today's reviews or new problems, LeetCode problem-list style. */
export function QueueList({ items }: { items: QueueItem[] }) {
  return (
    <ul className="flex flex-col" data-slot="queue">
      {items.map((i) => (
        <li
          key={i.slug}
          className="flex flex-col gap-1 rounded-md px-2 py-1.5 odd:bg-muted/40 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
        >
          <Link href={`/problems/${i.slug}`} className="min-w-0 truncate text-foreground">
            {i.frontendId ? `${i.frontendId}. ` : ""}
            {i.title ?? i.slug}
          </Link>
          <span className="flex items-center gap-2">
            {i.difficulty && <Difficulty value={i.difficulty} />}
            {i.kind === "new" ? (
              <Badge variant="secondary">new</Badge>
            ) : i.overdueDays > 0 ? (
              <Badge variant="outline" className="text-muted-foreground">
                overdue {i.overdueDays}d
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                due today
              </Badge>
            )}
            {i.forTarget && (
              <Badge className="bg-warn/15 text-warn" title="An extra review before this interview">
                before {i.forTarget.label}
              </Badge>
            )}
            {i.isLeech && (
              <Badge variant="destructive">
                <Term k="leech">leech</Term>
              </Badge>
            )}
            <a
              className="inline-flex items-center gap-1 text-xs"
              href={leetcodeUrl(i.slug)}
              target="_blank"
              rel="noreferrer"
            >
              Solve <ExternalLink className="size-3" aria-hidden />
            </a>
          </span>
        </li>
      ))}
    </ul>
  );
}
