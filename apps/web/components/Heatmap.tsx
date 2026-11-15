import type { Activity } from "@leettrack/insights";

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
export function Heatmap({ activity }: { activity: Activity }) {
  const weeks = Math.ceil(activity.days.length / 7);
  const width = weeks * (CELL + GAP) - GAP;
  const height = 7 * (CELL + GAP) - GAP;
  return (
    <svg
      className="heatmap"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={`${activity.total} attempts on ${activity.activeDays} days`}
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
  );
}
