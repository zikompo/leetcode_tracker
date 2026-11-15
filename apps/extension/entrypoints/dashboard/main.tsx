import { StrictMode, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { browser } from "wxt/browser";
import {
  MASTERY_LABELS,
  STATUS_LABELS,
  type PatternMastery,
  type ProblemStatus,
  type Settings,
} from "@leettrack/core";
import { Settings as SettingsIcon } from "lucide-react";
import type { ConfidenceGauge as GaugeData } from "@leettrack/insights";
import { Badge } from "@leettrack/ui/components/badge";
import { Button } from "@leettrack/ui/components/button";
import { ConfidenceGauge } from "@leettrack/ui/components/confidence-gauge";
import { Input } from "@leettrack/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@leettrack/ui/components/native-select";
import { Notice, Panel } from "@leettrack/ui/components/panel";
import { Switch } from "@leettrack/ui/components/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@leettrack/ui/components/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@leettrack/ui/components/tabs";
import { problemUrl } from "@/adapters/leetcode";
import { Logo } from "@/components/Logo";
import { followSystemTheme } from "@/components/theme";
import { call } from "@/lib/messaging";
import { allPatterns, patternName } from "@/lib/patterns";
import type { Dashboard as DashboardData, ListProgress } from "@/lib/types";
import "@/components/base.css";

followSystemTheme();

type Tab = "patterns" | "lists" | "leeches";
const pct = (x: number | undefined) => (x === undefined ? "–" : `${Math.round(x * 100)}%`);
const STATUS_ORDER: ProblemStatus[] = [
  "mastered",
  "fully_solved",
  "solved_with_help",
  "in_progress",
  "unseen",
];

function breakdown(m: PatternMastery): string {
  return [
    `Mastery ${pct(m.mastery)} = 50% retention + 30% cold-solve + 20% coverage`,
    `Retention ${pct(m.retention)}: how well you'd recall the ${m.attempted} problem(s) you've done, weighted by difficulty and how cleanly you solved them`,
    `Cold-solve ${pct(m.coldSolve)}: ${m.coldSolved} of ${m.coldAttempts} first attempts solved alone (smoothed)`,
    m.coverage === undefined
      ? "Coverage: not in your active lists, so not counted"
      : `Coverage ${pct(m.coverage)} of ${m.listTotal} problems in your active lists`,
  ].join("\n");
}

const LEVEL_TONE: Record<PatternMastery["level"], string> = {
  not_started: "text-muted-foreground",
  learning: "text-warn",
  developing: "text-medium",
  proficient: "text-ok",
  mastered: "text-primary",
};

function PatternsTab({
  data,
  settings,
  gauge,
  onSettings,
}: {
  data: DashboardData;
  settings: Settings;
  gauge: GaugeData | null;
  onSettings(): void;
}) {
  const name = (id: string) => patternName(id, settings);
  const rows = [...data.patterns].sort(
    (a, b) => Number(b.attempted > 0) - Number(a.attempted > 0) || b.mastery - a.mastery,
  );
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-3">
        {gauge && (
          <Panel title="To do today">
            <ConfidenceGauge {...gauge} compact className="justify-center" />
          </Panel>
        )}
        <Panel title="Weakest patterns">
          {data.insights.weakest.length === 0 ? (
            <p className="text-muted-foreground">
              Log a few attempts to see where you&apos;re weakest.
            </p>
          ) : (
            <ol className="flex flex-col gap-1.5">
              {data.insights.weakest.map((m) => (
                <li key={m.pattern} className="flex justify-between gap-2">
                  {name(m.pattern)}
                  <span className="text-xs text-muted-foreground">{pct(m.mastery)}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
        <Panel title="Can re-solve, hard to spot fresh">
          {data.insights.retentionColdGap.length === 0 ? (
            <p className="text-muted-foreground">
              No big gaps between retention and cold-solve yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {data.insights.retentionColdGap.map((m) => (
                <li key={m.pattern} className="flex justify-between gap-2">
                  {name(m.pattern)}
                  <span className="text-xs text-muted-foreground">
                    retention {pct(m.retention)} · cold {pct(m.coldSolve)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-muted-foreground">Pattern</TableHead>
              <TableHead className="text-muted-foreground">Level</TableHead>
              <TableHead className="text-muted-foreground">Mastery</TableHead>
              <TableHead className="text-muted-foreground" title="Retention">
                R
              </TableHead>
              <TableHead className="text-muted-foreground" title="Cold-solve">
                C
              </TableHead>
              <TableHead className="text-muted-foreground" title="Coverage of active lists">
                V
              </TableHead>
              <TableHead className="text-muted-foreground">Done</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((m) => (
              <TableRow key={m.pattern} title={breakdown(m)} className="even:bg-muted/30">
                <TableCell>{name(m.pattern)}</TableCell>
                <TableCell>
                  <span className={`level text-xs ${LEVEL_TONE[m.level]}`}>
                    {MASTERY_LABELS[m.level]}
                  </span>
                </TableCell>
                <TableCell>
                  <div
                    className="h-1.5 w-28 overflow-hidden rounded-full bg-muted"
                    role="img"
                    aria-label={`Mastery ${pct(m.mastery)}`}
                  >
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: pct(m.attempted ? m.mastery : 0) }}
                    />
                  </div>
                </TableCell>
                <TableCell className="tabular-nums">
                  {m.attempted ? pct(m.retention) : "–"}
                </TableCell>
                <TableCell className="tabular-nums">
                  {m.attempted ? pct(m.coldSolve) : "–"}
                </TableCell>
                <TableCell className="tabular-nums">{pct(m.coverage)}</TableCell>
                <TableCell className="tabular-nums">
                  {m.attempted}
                  {m.listTotal ? `/${m.listTotal}` : ""}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">Hover a row to see how its score is made up.</p>

      <ManageTags settings={settings} onDone={onSettings} />
    </div>
  );
}

function ManageTags({ settings, onDone }: { settings: Settings; onDone(): void }) {
  const patterns = allPatterns(settings);
  const [renameId, setRenameId] = useState(patterns[0]?.id ?? "");
  const [newName, setNewName] = useState("");
  const [from, setFrom] = useState("");
  const [into, setInto] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async (fn: () => Promise<unknown>, text: string) => {
    try {
      await fn();
      setMessage({ ok: true, text });
      onDone();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  };
  const select = (value: string, set: (v: string) => void, label: string) => (
    <NativeSelect value={value} onChange={(e) => set(e.target.value)} aria-label={label}>
      <NativeSelectOption value="">Choose…</NativeSelectOption>
      {patterns.map((p) => (
        <NativeSelectOption key={p.id} value={p.id}>
          {p.name}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
  return (
    <Panel title="Manage pattern tags">
      <div className="flex flex-wrap items-center gap-2">
        {select(renameId, setRenameId, "Pattern to rename")}
        <Input
          className="w-48"
          placeholder="New name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          aria-label="New name"
        />
        <Button
          variant="secondary"
          disabled={!renameId || !newName.trim()}
          onClick={() =>
            void run(() => call("renamePattern", { id: renameId, name: newName }), "Renamed.").then(
              () => setNewName(""),
            )
          }
        >
          Rename
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span>Merge</span>
        {select(from, setFrom, "Pattern to merge")}
        <span>into</span>
        {select(into, setInto, "Pattern to keep")}
        <Button
          variant="secondary"
          disabled={!from || !into}
          onClick={() =>
            void run(
              () => call("mergePattern", { from, into }),
              `Merged. Problems tagged ${patternName(from, settings)} are now ${patternName(into, settings)}.`,
            )
          }
        >
          Merge
        </Button>
      </div>
      {message && <Notice ok={message.ok}>{message.text}</Notice>}
    </Panel>
  );
}

const SEGMENT_COLOR: Record<ProblemStatus, string> = {
  mastered: "bg-primary",
  fully_solved: "bg-ok",
  solved_with_help: "bg-medium",
  in_progress: "bg-muted-foreground",
  unseen: "bg-muted",
};

function ListCard({ list, onToggle }: { list: ListProgress; onToggle(on: boolean): void }) {
  const started = list.total - list.byStatus.unseen;
  const id = `active-${list.id}`;
  return (
    <section className="list-card flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-medium">{list.name}</h2>
        <label htmlFor={id} className="flex items-center gap-2 text-xs text-muted-foreground">
          Active
          <Switch id={id} checked={list.active} onCheckedChange={onToggle} />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        {started} of {list.total} started · {list.byStatus.fully_solved + list.byStatus.mastered}{" "}
        fully solved
      </p>
      <div
        className="flex h-1.5 gap-px overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${list.name} progress`}
      >
        {STATUS_ORDER.filter((s) => s !== "unseen" && list.byStatus[s] > 0).map((s) => (
          <div
            key={s}
            className={SEGMENT_COLOR[s]}
            style={{ width: `${(list.byStatus[s] / list.total) * 100}%` }}
            title={`${STATUS_LABELS[s]}: ${list.byStatus[s]}`}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {STATUS_ORDER.map((s) => (
          <li key={s} className="flex items-center gap-1">
            <span className={`size-2 rounded-full ${SEGMENT_COLOR[s]}`} /> {STATUS_LABELS[s]}{" "}
            {list.byStatus[s]}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Dashboard() {
  const [tab, setTab] = useState<Tab>("patterns");
  const [data, setData] = useState<DashboardData | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [gauge, setGauge] = useState<GaugeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const [d, s, g] = await Promise.all([
        call("getDashboard"),
        call("getSettings"),
        call("getGauge"),
      ]);
      setData(d);
      setSettings(s);
      setGauge(g);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const toggleList = async (id: string, on: boolean) => {
    if (!settings) return;
    const ids = data?.lists.map((l) => l.id) ?? [];
    await call("setSettings", {
      activeLists: ids.filter((l) => (l === id ? on : settings.activeLists.includes(l))),
    });
    await load();
  };

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Logo className="size-7" /> LeetTrack dashboard
        </h1>
        <Button variant="secondary" onClick={() => browser.runtime.openOptionsPage()}>
          <SettingsIcon /> Settings
        </Button>
      </header>
      {error && <p className="text-bad">{error}</p>}
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="gap-4">
        <TabsList>
          <TabsTrigger value="patterns">Patterns</TabsTrigger>
          <TabsTrigger value="lists">Lists</TabsTrigger>
          <TabsTrigger value="leeches">
            Leeches{data ? ` (${data.leeches.length})` : ""}
          </TabsTrigger>
        </TabsList>
        {!data || !settings ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : (
          <>
            <TabsContent value="patterns">
              <PatternsTab
                data={data}
                settings={settings}
                gauge={gauge}
                onSettings={() => void load()}
              />
            </TabsContent>
            <TabsContent value="lists">
              <div className="grid items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
                {data.lists.map((l) => (
                  <ListCard key={l.id} list={l} onToggle={(on) => void toggleList(l.id, on)} />
                ))}
              </div>
            </TabsContent>
            <TabsContent value="leeches">
              {data.leeches.length === 0 ? (
                <p className="text-muted-foreground">
                  No leeches. A problem becomes one after being rated Again three times.
                </p>
              ) : (
                <div className="grid items-start gap-4 md:grid-cols-2">
                  {data.leeches.map((l) => (
                    <section
                      key={l.slug}
                      className="flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <a href={problemUrl(l.slug)} target="_blank" rel="noreferrer">
                          {l.title}
                        </a>
                        <Badge variant="destructive">Again ×{l.againCount}</Badge>
                      </div>
                      {l.stuckNotes.length === 0 ? (
                        <p className="text-muted-foreground">
                          No &quot;where I got stuck&quot; notes yet. Add one next attempt.
                        </p>
                      ) : (
                        <ul className="stuck flex flex-col gap-1">
                          {l.stuckNotes.map((n) => (
                            <li key={n.at}>
                              <span className="text-xs text-muted-foreground">
                                {new Date(n.at).toLocaleDateString()}
                              </span>{" "}
                              {n.note}
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  ))}
                </div>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Dashboard />
  </StrictMode>,
);
