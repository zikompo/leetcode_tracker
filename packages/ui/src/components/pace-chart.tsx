"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";

export interface PaceChartPoint {
  /** Formatted on the server, so client and server render the same text. */
  label: string;
  actual?: number;
  needed: number;
}

const H = 180;
const PAD = { left: 34, right: 12, top: 12, bottom: 26 };

/**
 * Problems started so far against a steady pace to the whole list (spec 7.1, Plan): one solid
 * line for you, a dashed reference line for the pace, a crosshair and tooltip on hover.
 */
export function PaceChart({
  points,
  total,
  title,
}: {
  points: PaceChartPoint[];
  total: number;
  title: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  // Draw at the real width so the axis text stays readable on a phone.
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  if (points.length < 2) return null;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const max = Math.max(1, total);
  const x = (i: number) => PAD.left + (i / (points.length - 1)) * plotW;
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const path = (vals: Array<number | undefined>) =>
    vals
      .map((v, i) => (v === undefined ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`))
      .filter(Boolean)
      .map((p, i) => `${i === 0 ? "M" : "L"}${p}`)
      .join(" ");
  const actual = points.map((p) => p.actual);
  let lastActual = -1;
  actual.forEach((v, i) => {
    if (v !== undefined) lastActual = i;
  });
  const ticks = [0, Math.round(max / 2), max];
  const h = hover === null ? null : points[hover]!;

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - box.left) / box.width;
    setHover(Math.min(points.length - 1, Math.max(0, Math.round(frac * (points.length - 1)))));
  };

  return (
    <figure className="m-0" data-slot="pace-chart">
      <div className="mb-1 flex gap-4 text-xs text-muted-foreground" aria-hidden>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block w-4 border-t-2 border-primary" /> Started
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block w-4 border-t-2 border-dashed border-muted-foreground" /> Steady
          pace
        </span>
      </div>
      <div className="relative" ref={box}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={title}
          className="block h-auto w-full overflow-visible"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                stroke="var(--border)"
                strokeWidth={1}
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(t)}
                y2={y(t)}
              />
              <text
                className="fill-muted-foreground text-[11px]"
                x={PAD.left - 6}
                y={y(t) + 4}
                textAnchor="end"
              >
                {t}
              </text>
            </g>
          ))}
          <text className="fill-muted-foreground text-[11px]" x={PAD.left} y={H - 6}>
            {points[0]!.label}
          </text>
          <text
            className="fill-muted-foreground text-[11px]"
            x={W - PAD.right}
            y={H - 6}
            textAnchor="end"
          >
            {points.at(-1)!.label}
          </text>
          <path
            fill="none"
            stroke="var(--muted-foreground)"
            strokeWidth={2}
            strokeDasharray="5 4"
            d={path(points.map((p) => p.needed))}
          />
          <path
            fill="none"
            stroke="var(--primary)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            d={path(actual)}
          />
          {lastActual >= 0 && (
            <circle
              fill="var(--primary)"
              stroke="var(--card)"
              strokeWidth={2}
              cx={x(lastActual)}
              cy={y(actual[lastActual]!)}
              r={4.5}
            />
          )}
          {h && hover !== null && (
            <g pointerEvents="none">
              <line
                stroke="var(--muted-foreground)"
                strokeWidth={1}
                x1={x(hover)}
                x2={x(hover)}
                y1={PAD.top}
                y2={PAD.top + plotH}
              />
              {h.actual !== undefined && (
                <circle
                  fill="var(--primary)"
                  stroke="var(--card)"
                  strokeWidth={2}
                  cx={x(hover)}
                  cy={y(h.actual)}
                  r={4.5}
                />
              )}
            </g>
          )}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={plotW}
            height={plotH}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
        {h && hover !== null && (
          <div
            className="pointer-events-none absolute top-2 flex flex-col gap-0.5 rounded-md border bg-popover px-2.5 py-1.5 text-xs whitespace-nowrap text-popover-foreground shadow-md"
            role="status"
            style={{
              left: `${(x(hover) / W) * 100}%`,
              transform:
                hover > points.length / 2 ? "translateX(calc(-100% - 10px))" : "translateX(10px)",
            }}
          >
            <strong>{h.label}</strong>
            {h.actual !== undefined && <span>Started: {h.actual}</span>}
            <span>Steady pace: {h.needed}</span>
          </div>
        )}
      </div>
    </figure>
  );
}
