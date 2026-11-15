import Link from "next/link";
import type { QueueItem } from "@leettrack/core";
import { leetcodeUrl } from "@/lib/util";

export function QueueList({ items }: { items: QueueItem[] }) {
  return (
    <ul className="list">
      {items.map((i) => (
        <li key={i.slug}>
          <Link href={`/problems/${i.slug}`}>
            {i.frontendId ? `${i.frontendId}. ` : ""}
            {i.title ?? i.slug}
          </Link>
          <span className="row">
            {i.difficulty && <span className={`small diff-${i.difficulty}`}>{i.difficulty}</span>}
            <span className={`pill ${i.kind === "new" ? "pill-accent" : ""}`}>
              {i.kind === "new"
                ? "new"
                : i.overdueDays > 0
                  ? `overdue ${i.overdueDays}d`
                  : "due today"}
            </span>
            {i.isLeech && <span className="pill pill-bad">leech</span>}
            <a className="small" href={leetcodeUrl(i.slug)} target="_blank" rel="noreferrer">
              Solve ↗
            </a>
          </span>
        </li>
      ))}
    </ul>
  );
}
