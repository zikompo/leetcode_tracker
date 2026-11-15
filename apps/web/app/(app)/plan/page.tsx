import Link from "next/link";
import { dateKey, fromDateKey, type PlanDay } from "@leettrack/core";
import {
  allLists,
  patternName,
  targetsFrom,
  type PlanItem,
  type TargetView,
} from "@leettrack/insights";
import { ExternalLink } from "lucide-react";
import { Badge } from "@leettrack/ui/components/badge";
import { PaceChart } from "@leettrack/ui/components/pace-chart";
import { Difficulty, Panel, Stat } from "@leettrack/ui/components/panel";
import { cn } from "@leettrack/ui/lib/utils";
import { PageHead } from "@/components/PageHead";
import { loadSnapshot } from "@/lib/data";
import { leetcodeUrl } from "@/lib/util";
import { PlanOptions, TargetActions, TargetForm } from "./TargetForms";

export const metadata = { title: "Plan" };

/** Days shown before the rest fold away. */
const FIRST_DAYS = 7;

const dayLabel = (key: string, today: string) => {
  const d = fromDateKey(key);
  const diff = Math.round((d.getTime() - fromDateKey(today).getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
};
const shortDate = (key: string) =>
  fromDateKey(key).toLocaleDateString(undefined, { day: "numeric", month: "short" });
const longDate = (key: string) =>
  fromDateKey(key).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function PaceBadge({ ahead }: { ahead: number }) {
  if (ahead > 0) return <Badge className="bg-ok/15 text-ok">Ahead by {ahead}</Badge>;
  if (ahead < 0) return <Badge variant="destructive">Behind by {-ahead}</Badge>;
  return <Badge variant="secondary">On pace</Badge>;
}

function Day({
  day,
  today,
  name,
}: {
  day: PlanDay<PlanItem>;
  today: string;
  name(id: string): string;
}) {
  const groups = new Map<string, PlanItem[]>();
  for (const p of day.problems) {
    const key = p.patterns[0] ?? "";
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  return (
    <li
      data-slot="plan-day"
      className="grid gap-1 border-t py-2.5 first:border-t-0 sm:grid-cols-[130px_1fr] sm:gap-3"
    >
      <div className="flex items-baseline gap-2 sm:flex-col sm:gap-0">
        <strong className={cn("text-sm font-medium", day.kind === "target" && "text-primary")}>
          {dayLabel(day.date, today)}
        </strong>
        {day.reviews > 0 && (
          <span className="text-xs text-muted-foreground">{plural(day.reviews, "review")}</span>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        {day.kind === "target" ? (
          <span>Interview day. Good luck.</span>
        ) : day.kind === "review" ? (
          <span className="text-muted-foreground">
            {day.quietFor
              ? `Reviews only: ${day.quietFor} is close.`
              : "Reviews only: no new problems."}
          </span>
        ) : day.problems.length === 0 ? (
          <span className="text-muted-foreground">No new problems planned.</span>
        ) : (
          [...groups].map(([pattern, items]) => (
            <div key={pattern} className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">
                {pattern ? name(pattern) : "Other"}
              </span>
              <ul className="flex flex-col gap-1">
                {items.map((p) => (
                  <li key={p.slug} className="flex flex-wrap items-center justify-between gap-x-3">
                    <Link href={`/problems/${p.slug}`} className="min-w-0 text-foreground">
                      {p.frontendId ? `${p.frontendId}. ` : ""}
                      {p.title}
                    </Link>
                    <span className="flex items-center gap-2">
                      <Difficulty value={p.difficulty} />
                      <a
                        className="inline-flex items-center gap-1 text-xs"
                        href={leetcodeUrl(p.slug)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Solve <ExternalLink className="size-3" aria-hidden />
                      </a>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </li>
  );
}

function Target({
  view,
  today,
  lists,
  name,
  dailyNewLimit,
}: {
  view: TargetView;
  today: string;
  lists: { id: string; name: string }[];
  name(id: string): string;
  dailyNewLimit: number;
}) {
  const { target, plan, pace } = view;
  const days = plan.days;
  return (
    <Panel
      id={`target-${target.id}`}
      title={<span className="text-base font-semibold">{target.label}</span>}
      description={`${longDate(target.date)} · ${
        view.daysLeft === 0 ? "today" : `in ${plural(view.daysLeft, "day")}`
      } · ${view.lists.map((l) => l.name).join(", ") || "no lists"}`}
      action={<TargetActions target={target} lists={lists} today={today} />}
      bodyClassName="gap-4"
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat value={`${view.started}/${view.total}`} label="problems started" />
        <Stat value={view.total - view.started} label="left to start" />
        <Stat value={view.extraReviews} label="extra reviews before the day" />
        <Stat value={<PaceBadge ahead={pace.ahead} />} label="against a steady pace" />
      </div>

      {view.total - view.started === 0 ? (
        <p className="text-ok">Every problem on these lists is started. Reviews keep them fresh.</p>
      ) : plan.unplanned > 0 ? (
        <p className="text-xs text-bad">
          At {dailyNewLimit} new a day, {plural(plan.unplanned, "problem")} won&apos;t fit before
          new problems stop on {shortDate(view.newStopsOn)}.{" "}
          {plan.learnDays > 0
            ? `It takes ${plan.neededPerDay} a day: raise your daily limit in Settings, or narrow the lists.`
            : "Focus on reviews from here."}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          At {dailyNewLimit} new a day you&apos;ll have started everything by{" "}
          {shortDate(plan.finishesOn!)}. New problems stop on {shortDate(view.newStopsOn)}.
        </p>
      )}

      <PaceChart
        title={`${target.label}: ${pace.done} of ${pace.total} started; ${
          pace.ahead > 0
            ? `ahead by ${pace.ahead}`
            : pace.ahead < 0
              ? `behind by ${-pace.ahead}`
              : "on pace"
        }`}
        total={pace.total}
        points={pace.points.map((p) => ({
          label: shortDate(p.date),
          needed: p.needed,
          ...(p.actual !== undefined ? { actual: p.actual } : {}),
        }))}
      />

      <div className="flex flex-col">
        <h3 className="mb-1 text-xs font-medium text-muted-foreground">Day by day</h3>
        <ol className="flex flex-col">
          {days.slice(0, FIRST_DAYS).map((d) => (
            <Day key={d.date} day={d} today={today} name={name} />
          ))}
        </ol>
        {days.length > FIRST_DAYS && (
          <details className="group">
            <summary className="cursor-pointer py-2 text-xs text-link">
              Show the other {plural(days.length - FIRST_DAYS, "day")}
            </summary>
            <ol className="flex flex-col">
              {days.slice(FIRST_DAYS).map((d) => (
                <Day key={d.date} day={d} today={today} name={name} />
              ))}
            </ol>
          </details>
        )}
      </div>
    </Panel>
  );
}

export default async function PlanPage() {
  const { snap } = await loadSnapshot();
  const views = targetsFrom(snap);
  const today = dateKey(snap.now);
  const lists = allLists(snap).map((l) => ({ id: l.id, name: l.name }));
  const name = (id: string) => patternName(id, snap.settings);

  return (
    <>
      <PageHead title="Plan">
        {views.length === 0
          ? "Set an interview date to plan toward it."
          : `${plural(views.length, "interview")} coming up`}
      </PageHead>

      {views.map((v) => (
        <Target
          key={v.target.id}
          view={v}
          today={today}
          lists={lists}
          name={name}
          dailyNewLimit={snap.settings.dailyNewLimit}
        />
      ))}

      <div className="grid items-start gap-4 md:grid-cols-2">
        <Panel
          title="Add an interview"
          description={
            views.length === 0
              ? "LeetTrack plans the problems left on your lists across the days you have, one pattern at a time, brings shaky problems back for a review just before, and keeps the last days for reviews only."
              : undefined
          }
        >
          <TargetForm lists={lists} today={today} />
        </Panel>
        <Panel title="Before an interview">
          <PlanOptions settings={snap.settings} />
        </Panel>
      </div>
    </>
  );
}
