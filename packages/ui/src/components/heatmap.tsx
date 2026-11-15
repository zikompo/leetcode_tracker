import { cn } from "#lib/utils";

export interface HeatmapData {
  /** Whole weeks, oldest first, Sunday to Saturday. */
  days: readonly { date: string; count: number }[];
  total: number;
  activeDays: number;
}

const CELL = 11;
const GAP = 3;
const LEVEL_FILL = [
  "var(--heat-0)",
  "var(--heat-1)",
  "var(--heat-2)",
  "var(--heat-3)",
  "var(--heat-4)",
];

/** Attempts per day as a weeks-by-weekdays grid, like a contribution graph. */
export function Heatmap({ activity, className }: { activity: HeatmapData; className?: string }) {
  const weeks = Math.ceil(activity.days.length / 7);
  const width = weeks * (CELL + GAP) - GAP;
  const height = 7 * (CELL + GAP) - GAP;
  return (
    <div className={cn("min-w-0", className)}>
      {/* Scales down to fit its box; never wider than its natural size. */}
      <svg
        data-slot="heatmap"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${activity.total} attempts on ${activity.activeDays} days`}
        className="block h-auto w-full"
        style={{ maxWidth: width }}
      >
        {activity.days.map((d, i) => (
          <rect
            key={d.date}
            x={Math.floor(i / 7) * (CELL + GAP)}
            y={(i % 7) * (CELL + GAP)}
            width={CELL}
            height={CELL}
            rx={2}
            fill={LEVEL_FILL[Math.min(d.count, 4)]}
          >
            <title>{`${d.date}: ${d.count} attempt${d.count === 1 ? "" : "s"}`}</title>
          </rect>
        ))}
      </svg>
    </div>
  );
}
