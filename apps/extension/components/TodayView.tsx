import { Term } from "@leettrack/ui/components/term";
import { browser } from "wxt/browser";
import { AlarmClock } from "lucide-react";
import type { Queue, QueueItem } from "@leettrack/core";
import type { ConfidenceGauge as GaugeData } from "@leettrack/insights";
import { Badge } from "@leettrack/ui/components/badge";
import { Button } from "@leettrack/ui/components/button";
import { ConfidenceGauge } from "@leettrack/ui/components/confidence-gauge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@leettrack/ui/components/dropdown-menu";
import { Difficulty } from "@leettrack/ui/components/panel";
import { problemUrl } from "@/adapters/leetcode";
import { formatDue } from "@/lib/format";
import { call } from "@/lib/messaging";

/** Today's reviews and new problems, with the gauge: the popup's and side panel's main view. */
function QueueRow({ item, onSnooze }: { item: QueueItem; onSnooze?(days: number): void }) {
  const marker =
    item.kind === "new"
      ? "new"
      : item.overdueDays > 0
        ? `overdue ${item.overdueDays}d`
        : "due today";
  return (
    <li className="flex items-start gap-1">
      <button
        className="queue-row flex min-w-0 flex-1 flex-col gap-1 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent"
        onClick={() => void browser.tabs.create({ url: problemUrl(item.slug) })}
        title={item.kind === "review" && item.due ? `Due ${formatDue(item.due)}` : undefined}
      >
        <span className="truncate text-sm">
          {item.frontendId ? `${item.frontendId}. ` : ""}
          {item.title ?? item.slug}
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          {item.difficulty && <Difficulty value={item.difficulty} />}
          <Badge variant={item.kind === "new" ? "secondary" : "outline"} className="text-[11px]">
            {marker}
          </Badge>
          {item.forTarget && (
            <Badge
              className="bg-warn/15 text-[11px] text-warn"
              title="An extra review before this interview"
            >
              before {item.forTarget.label}
            </Badge>
          )}
          {item.quickEligible && (
            <Badge variant="outline" className="text-[11px]">
              <Term k="quick">quick</Term>
            </Badge>
          )}
          {item.isLeech && (
            <Badge variant="destructive" className="text-[11px]">
              leech
            </Badge>
          )}
        </span>
      </button>
      {onSnooze && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="mt-1 shrink-0"
              aria-label={`Snooze ${item.title ?? item.slug}`}
              title="Snooze"
            >
              <AlarmClock />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onSnooze(1)}>Snooze until tomorrow</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onSnooze(3)}>Snooze 3 days</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}

function Section({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={label} className="flex flex-col gap-1">
      <h2 className="flex items-center gap-2 px-2 text-xs font-medium text-muted-foreground">
        {label === "New problems" ? "New" : label}
        <span className="rounded-full bg-secondary px-1.5 text-[11px] tabular-nums">{count}</span>
      </h2>
      {children}
    </section>
  );
}

export function Today({
  queue,
  gauge,
  onQueue,
}: {
  queue: Queue | null;
  gauge: GaugeData | null;
  onQueue(q: Queue): void;
}) {
  if (!queue) return <p className="text-muted-foreground">Loading…</p>;
  const reviews = queue.items.filter((i) => i.kind === "review");
  const fresh = queue.items.filter((i) => i.kind === "new");
  const capped = queue.reviewsDue - reviews.length;
  return (
    <div className="flex flex-col gap-3">
      {gauge && gauge.tracked > 0 && (
        <div className="flex justify-center">
          <ConfidenceGauge {...gauge} compact />
        </div>
      )}
      <Section label="Reviews" count={reviews.length}>
        {reviews.length === 0 ? (
          <p className="px-2 text-muted-foreground">
            Nothing due. {queue.reviewsDoneToday > 0 && "All done for today."}
          </p>
        ) : (
          <ol className="flex flex-col">
            {reviews.map((i) => (
              <QueueRow
                key={i.slug}
                item={i}
                onSnooze={(days) => void call("snoozeReview", { slug: i.slug, days }).then(onQueue)}
              />
            ))}
          </ol>
        )}
        {capped > 0 && (
          <p className="px-2 text-xs text-muted-foreground">
            {capped} more due, held back by your daily limit.
          </p>
        )}
      </Section>
      <Section label="New problems" count={fresh.length}>
        {fresh.length === 0 ? (
          <p className="px-2 text-muted-foreground">
            {queue.noNewFor
              ? `None today: ${queue.noNewFor.label} is close, so it's reviews only.`
              : queue.newDoneToday > 0
                ? "You've started today's new problems."
                : "No new problems: pick an active list in settings."}
          </p>
        ) : (
          <ol className="flex flex-col">
            {fresh.map((i) => (
              <QueueRow key={i.slug} item={i} />
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}
