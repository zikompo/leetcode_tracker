"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";

export interface TrendChartPoint {
  /** Formatted on the server, e.g. "Oct". */
  label: string;
  /** Absent where there's no data for that point; the line skips it. */
  value?: number;
}

const H = 120;
const PAD = { left: 36, right: 12, top: 10, bottom: 22 };

/**
 * One measure over time: a single line with a dot per point, the latest value labelled, and a
 * tooltip on hover. Two measures get two charts, never two axes on one.
 */
export function TrendChart({
  title,
  points,
  unit,
  max,
  empty = "Not enough data yet.",
}: {
  /** Names the chart for assistive tech, e.g. "Cold-solve rate by month". */
  title: string;
  points: readonly TrendChartPoint[];
  /** How values read: a 0–1 share as a percentage, or a number of minutes. */
  unit: "percent" | "minutes";
  /** Top of the y axis; defaults to the largest value. */
  max?: number;
  empty?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(320);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.round(e!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const format = (v: number) =>
    unit === "percent" ? `${Math.round(v * 100)}%` : `${Math.round(v)}m`;
  const values = points.flatMap((p) => (p.value === undefined ? [] : [p.value]));
  const top = Math.max(max ?? 0, ...values, 0) || 1;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) =>
    PAD.left + (points.length > 1 ? (i / (points.length - 1)) * plotW : plotW / 2);
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const segments: string[] = [];
  let run: string[] = [];
  points.forEach((p, i) => {
    if (p.value === undefined) {
      if (run.length) segments.push(run.join(" "));
      run = [];
    } else run.push(`${run.length ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`);
  });
  if (run.length) segments.push(run.join(" "));
  let last = -1;
  points.forEach((p, i) => {
    if (p.value !== undefined) last = i;
  });
  const h = hover !== null ? points[hover] : undefined;
  const summary =
    values.length === 0
      ? `${title}: ${empty}`
      : `${title}: ${points
          .filter((p) => p.value !== undefined)
          .map((p) => `${p.label} ${format(p.value!)}`)
          .join(", ")}`;

  return (
    <div className="relative" ref={box} data-slot="trend-chart">
      {values.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">{empty}</p>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={summary}
          className="block h-auto w-full overflow-visible"
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const frac = (e.clientX - r.left - (PAD.left * r.width) / W) / ((plotW * r.width) / W);
            setHover(
              Math.min(points.length - 1, Math.max(0, Math.round(frac * (points.length - 1)))),
            );
          }}
          onPointerLeave={() => setHover(null)}
        >
          {[0, top].map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--border)" />
              <text
                x={PAD.left - 6}
                y={y(t) + 4}
                textAnchor="end"
                className="fill-muted-foreground text-[10px]"
              >
                {format(t)}
              </text>
            </g>
          ))}
          {points.map((p, i) => (
            <text
              key={p.label + i}
              x={x(i)}
              y={H - 6}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {p.label}
            </text>
          ))}
          {segments.map((d) => (
            <path
              key={d}
              d={d}
              fill="none"
              stroke="var(--primary)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {points.map((p, i) =>
            p.value === undefined ? null : (
              <circle
                key={i}
                cx={x(i)}
                cy={y(p.value)}
                r={hover === i || i === last ? 4.5 : 3}
                fill="var(--primary)"
                stroke="var(--card)"
                strokeWidth={2}
              />
            ),
          )}
          {last >= 0 && hover === null && (
            <text
              x={x(last)}
              y={y(points[last]!.value!) - 9}
              textAnchor={last === points.length - 1 ? "end" : "middle"}
              className="fill-foreground text-[11px] font-medium"
            >
              {format(points[last]!.value!)}
            </text>
          )}
          {hover !== null && (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              stroke="var(--muted-foreground)"
              pointerEvents="none"
            />
          )}
        </svg>
      )}
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 rounded-md border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-md"
          style={{
            left: `${(x(hover) / W) * 100}%`,
            transform:
              hover > points.length / 2 ? "translateX(calc(-100% - 8px))" : "translateX(8px)",
          }}
        >
          <strong className="font-medium">{h.label}</strong>{" "}
          {h.value === undefined ? "no data" : format(h.value)}
        </div>
      )}
    </div>
  );
}
