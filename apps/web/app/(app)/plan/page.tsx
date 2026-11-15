import Link from "next/link";
import { dateKey, fromDateKey, type PlanDay } from "@leettrack/core";
import {
  allLists,
  patternName,
  targetsFrom,
  type PlanItem,
  type TargetView,
} from "@leettrack/insights";
import { PaceChart } from "@/components/PaceChart";
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
  if (ahead > 0) return <span className="pill pill-ok">Ahead by {ahead}</span>;
  if (ahead < 0) return <span className="pill pill-bad">Behind by {-ahead}</span>;
  return <span className="pill">On pace</span>;
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
    <li className={`plan-day plan-${day.kind}`}>
      <div className="plan-date">
        <strong>{dayLabel(day.date, today)}</strong>
        {day.reviews > 0 && <span className="muted small">{plural(day.reviews, "review")}</span>}
      </div>
      <div className="stack plan-body">
        {day.kind === "target" ? (
          <span>Interview day. Good luck.</span>
        ) : day.kind === "review" ? (
          <span className="muted">
            {day.quietFor
              ? `Reviews only: ${day.quietFor} is close.`
              : "Reviews only: no new problems."}
          </span>
        ) : day.problems.length === 0 ? (
          <span className="muted">No new problems planned.</span>
        ) : (
          [...groups].map(([pattern, items]) => (
            <div key={pattern} className="plan-group">
              <span className="small muted">{pattern ? name(pattern) : "Other"}</span>
              <ul className="list">
                {items.map((p) => (
                  <li key={p.slug}>
                    <Link href={`/problems/${p.slug}`}>
                      {p.frontendId ? `${p.frontendId}. ` : ""}
                      {p.title}
                    </Link>
                    <span className="row">
                      <span className={`small diff-${p.difficulty}`}>{p.difficulty}</span>
                      <a
                        className="small"
                        href={leetcodeUrl(p.slug)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Solve ↗
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
  const headingId = `target-${target.id}`;
  const days = plan.days;
  return (
    <section className="card stack" aria-labelledby={headingId}>
      <div className="row spread">
        <div className="stack" style={{ gap: 2 }}>
          <h2 id={headingId} className="target-title">
            {target.label}
          </h2>
          <span className="muted small">
            {longDate(target.date)} ·{" "}
            {view.daysLeft === 0 ? "today" : `in ${plural(view.daysLeft, "day")}`} ·{" "}
            {view.lists.map((l) => l.name).join(", ") || "no lists"}
          </span>
        </div>
        <TargetActions target={target} lists={lists} today={today} />
      </div>

      <div className="stats">
        <div className="stat">
          <strong>
            {view.started}/{view.total}
          </strong>
          <span>problems started</span>
        </div>
        <div className="stat">
          <strong>{view.total - view.started}</strong>
          <span>left to start</span>
        </div>
        <div className="stat">
          <strong>{view.extraReviews}</strong>
          <span>extra reviews before the day</span>
        </div>
        <div className="stat">
          <strong>
            <PaceBadge ahead={pace.ahead} />
          </strong>
          <span>against a steady pace</span>
        </div>
      </div>

      {view.total - view.started === 0 ? (
        <p className="ok">Every problem on these lists is started. Reviews keep them fresh.</p>
      ) : plan.unplanned > 0 ? (
        <p className="bad small">
          At {dailyNewLimit} new a day, {plural(plan.unplanned, "problem")} won&apos;t fit before
          new problems stop on {shortDate(view.newStopsOn)}.{" "}
          {plan.learnDays > 0
            ? `It takes ${plan.neededPerDay} a day: raise your daily limit in Settings, or narrow the lists.`
            : "Focus on reviews from here."}
        </p>
      ) : (
        <p className="muted small">
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

      <h3 className="plan-heading">Day by day</h3>
      <ol className="plan">
        {days.slice(0, FIRST_DAYS).map((d) => (
          <Day key={d.date} day={d} today={today} name={name} />
        ))}
      </ol>
      {days.length > FIRST_DAYS && (
        <details>
          <summary className="small">
            Show the other {plural(days.length - FIRST_DAYS, "day")}
          </summary>
          <ol className="plan">
            {days.slice(FIRST_DAYS).map((d) => (
              <Day key={d.date} day={d} today={today} name={name} />
            ))}
          </ol>
        </details>
      )}
    </section>
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
      <div className="page-head">
        <h1>Plan</h1>
        <span className="muted small">
          {views.length === 0
            ? "Set an interview date to plan toward it."
            : `${plural(views.length, "interview")} coming up`}
        </span>
      </div>

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

      <div className="grid">
        <section className="card stack" aria-labelledby="add-target">
          <h2 id="add-target">Add an interview</h2>
          {views.length === 0 && (
            <p className="muted small">
              LeetTrack plans the problems left on your lists across the days you have, one pattern
              at a time, brings shaky problems back for a review just before, and keeps the last
              days for reviews only.
            </p>
          )}
          <TargetForm lists={lists} today={today} />
        </section>
        <section className="card stack" aria-labelledby="plan-options">
          <h2 id="plan-options">Before an interview</h2>
          <PlanOptions settings={snap.settings} />
        </section>
      </div>
    </>
  );
}
