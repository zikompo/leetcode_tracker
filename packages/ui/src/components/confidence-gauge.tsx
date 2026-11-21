"use client";

import { Term } from "#components/term";
import * as React from "react";
import { cn } from "#lib/utils";

export interface GaugeBandData {
  rating: 1 | 2 | 3 | 4;
  label: string;
  count: number;
  dueToday: number;
}

export interface ConfidenceGaugeProps {
  toDo: number;
  reviewsToday: number;
  newToday: number;
  tracked: number;
  bands: readonly GaugeBandData[];
  /** Drop the legend (the popup). */
  compact?: boolean;
  className?: string;
}

const COLOR: Record<GaugeBandData["rating"], string> = {
  1: "var(--rating-again)",
  2: "var(--rating-hard)",
  3: "var(--rating-good)",
  4: "var(--rating-easy)",
};

const SIZE = 160;
const C = SIZE / 2;
const R = 66;
const STROKE = 7;
const START = 135; // degrees, clockwise from +x: bottom left
const SWEEP = 270; // open at the bottom
const GAP_PX = 3;
const MIN_DEG = 10;

const rad = (deg: number) => (deg * Math.PI) / 180;
const point = (deg: number) => [C + R * Math.cos(rad(deg)), C + R * Math.sin(rad(deg))] as const;
function arc(from: number, to: number) {
  if (to - from < 0.01) return "";
  const [x0, y0] = point(from);
  const [x1, y1] = point(to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/** Each non-empty band's span of the arc, by count, with a small minimum and gaps between. */
function layout(bands: readonly GaugeBandData[]) {
  const shown = bands.filter((b) => b.count > 0);
  const total = shown.reduce((n, b) => n + b.count, 0);
  // Round caps reach STROKE/2 past each end, so the gap has to cover them too.
  const gap = ((GAP_PX + STROKE) / R) * (180 / Math.PI);
  const room = SWEEP - gap * Math.max(0, shown.length - 1);
  const spare = Math.max(0, room - MIN_DEG * shown.length);
  let at = START;
  return shown.map((b) => {
    const span = MIN_DEG + (spare * b.count) / total;
    const seg = { band: b, from: at, to: at + span };
    at += span + gap;
    return seg;
  });
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Today's work in the middle; around it, your problems by how the last attempt went (Again,
 * Hard, Good, Easy). Each arc is sized by its count; the bright part is what's due today.
 */
export function ConfidenceGauge({
  toDo,
  reviewsToday,
  newToday,
  tracked,
  bands,
  compact = false,
  className,
}: ConfidenceGaugeProps) {
  const [active, setActive] = React.useState<GaugeBandData["rating"] | null>(null);
  const segments = layout(bands);
  const focus = segments.find((s) => s.band.rating === active)?.band;
  const summary = `${plural(toDo, "problem")} to do today: ${plural(reviewsToday, "review")} and ${newToday} new. Last ratings: ${bands
    .map((b) => `${b.label} ${b.count}${b.dueToday ? ` (${b.dueToday} due)` : ""}`)
    .join(", ")}.`;

  const breakdown = (reviewsToday > 0 || newToday > 0) && (
    <span className={cn("text-[11px] text-muted-foreground", compact ? "-mt-3" : "mt-1")}>
      {reviewsToday} review{reviewsToday === 1 ? "" : "s"}
      {newToday > 0 && ` · ${newToday} new`}
    </span>
  );

  return (
    <div
      className={cn("flex items-center gap-6", compact && "flex-col gap-0", className)}
      data-slot="confidence-gauge"
    >
      <div className={cn("relative shrink-0", compact ? "size-32" : "size-44")}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="size-full" role="img" aria-label={summary}>
          {segments.length === 0 ? (
            <path
              d={arc(START, START + SWEEP)}
              fill="none"
              stroke="var(--muted)"
              strokeWidth={STROKE}
              strokeLinecap="round"
            />
          ) : (
            segments.map(({ band, from, to }) => {
              const lit = from + ((to - from) * band.dueToday) / band.count;
              const dim = active !== null && active !== band.rating;
              return (
                <g
                  key={band.rating}
                  className="cursor-default transition-opacity"
                  opacity={dim ? 0.35 : 1}
                  onPointerEnter={() => setActive(band.rating)}
                  onPointerLeave={() => setActive(null)}
                >
                  <title>{`${band.label}: ${plural(band.count, "problem")}, ${band.dueToday} due today`}</title>
                  {/* Wide invisible stroke: an easier target than the 7px arc. */}
                  <path d={arc(from, to)} fill="none" stroke="transparent" strokeWidth={22} />
                  <path
                    d={arc(from, to)}
                    fill="none"
                    stroke={COLOR[band.rating]}
                    strokeOpacity={0.28}
                    strokeWidth={STROKE}
                    strokeLinecap="round"
                  />
                  {band.dueToday > 0 && (
                    <path
                      d={arc(from, lit)}
                      fill="none"
                      stroke={COLOR[band.rating]}
                      strokeWidth={STROKE}
                      strokeLinecap="round"
                    />
                  )}
                </g>
              );
            })
          )}
        </svg>
        <div
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
          aria-hidden
        >
          {focus ? (
            <>
              <span className="flex items-center gap-1.5 text-xs font-medium">
                <span className="size-2 rounded-full" style={{ background: COLOR[focus.rating] }} />
                {focus.label}
              </span>
              <span className="text-3xl font-semibold tabular-nums">{focus.count}</span>
              <span className="text-xs text-muted-foreground">{focus.dueToday} due today</span>
            </>
          ) : (
            <>
              <span className={cn("font-semibold tabular-nums", compact ? "text-3xl" : "text-5xl")}>
                {toDo}
              </span>
              <span className="pointer-events-auto text-xs text-muted-foreground">
                <Term k="toDo">to do today</Term>
              </span>
              {/* The compact gauge is too narrow for this line inside the arc: it goes below. */}
              {!compact && breakdown}
            </>
          )}
        </div>
      </div>
      {compact && !focus && breakdown}

      {!compact && (
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">
            {plural(tracked, "problem")} by <Term k="lastRating">last rating</Term>
          </span>
          <ul className="flex flex-col gap-1.5" aria-label="Last ratings">
            {bands.map((b) => (
              <li
                key={b.rating}
                tabIndex={b.count > 0 ? 0 : -1}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-md bg-muted/60 px-3 py-1.5 outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-ring",
                  active !== null && active !== b.rating && "opacity-50",
                )}
                onPointerEnter={() => b.count > 0 && setActive(b.rating)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(b.rating)}
                onBlur={() => setActive(null)}
              >
                <span className="flex items-center gap-2 text-xs font-medium">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: COLOR[b.rating] }}
                    aria-hidden
                  />
                  {b.label}
                </span>
                <span className="text-xs tabular-nums">
                  <strong className="font-semibold">{b.count}</strong>
                  {b.dueToday > 0 && (
                    <span className="text-muted-foreground"> · {b.dueToday} due</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
