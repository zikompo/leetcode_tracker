import type { Rating } from "@leettrack/core";

const COLOR: Record<Rating, string> = {
  1: "var(--rating-again)",
  2: "var(--rating-hard)",
  3: "var(--rating-good)",
  4: "var(--rating-easy)",
};

/** An attempt's rating, with the gauge's colour as a dot (the text carries the meaning). */
export function RatingBadge({ rating, label }: { rating: Rating; label: string }) {
  return (
    <span className="inline-flex h-5 items-center gap-1.5 rounded-full border px-2 text-xs">
      <span className="size-2 rounded-full" style={{ background: COLOR[rating] }} aria-hidden />
      {label}
    </span>
  );
}
