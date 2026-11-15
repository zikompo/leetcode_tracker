import * as React from "react";
import { cn } from "#lib/utils";

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * A card with a heading, as a labelled region: the building block of every page. `title` names
 * the region for assistive tech (and tests), so keep it short and unique on the page.
 */
export function Panel({
  title,
  id,
  action,
  description,
  className,
  bodyClassName,
  children,
  ...props
}: Omit<React.ComponentProps<"section">, "title"> & {
  title: React.ReactNode;
  /** Heading id; derived from a string title when omitted. */
  id?: string;
  action?: React.ReactNode;
  description?: React.ReactNode;
  bodyClassName?: string;
}) {
  const headingId = id ?? `panel-${typeof title === "string" ? slug(title) : "section"}`;
  return (
    <section
      data-slot="panel"
      aria-labelledby={headingId}
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id={headingId} className="text-sm font-medium text-foreground">
            {title}
          </h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      <div className={cn("flex min-w-0 flex-col gap-3", bodyClassName)}>{children}</div>
    </section>
  );
}

/** A big number with a label under it. */
export function Stat({
  value,
  label,
  className,
}: {
  value: React.ReactNode;
  label: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5", className)} data-slot="stat">
      <strong className="text-2xl leading-tight font-semibold tabular-nums">{value}</strong>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

/** Difficulty in its LeetCode colour. */
export function Difficulty({ value, className }: { value: string; className?: string }) {
  const color =
    value === "Easy"
      ? "text-easy"
      : value === "Medium"
        ? "text-medium"
        : value === "Hard"
          ? "text-hard"
          : "";
  return <span className={cn("text-xs font-medium", color, className)}>{value}</span>;
}

/** Short status line for a form result. */
export function Notice({
  ok,
  children,
  className,
}: {
  ok: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p role="status" className={cn("text-xs", ok ? "text-ok" : "text-bad", className)}>
      {children}
    </p>
  );
}
