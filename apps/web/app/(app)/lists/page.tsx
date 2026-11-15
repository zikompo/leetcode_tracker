import { STATUS_LABELS } from "@leettrack/core";
import { listProgress, statusOf } from "@leettrack/insights";
import { loadSnapshot } from "@/lib/data";
import { ListManager, type ListView } from "./ListManager";

export const metadata = { title: "Lists" };

export default async function ListsPage() {
  const { snap } = await loadSnapshot();
  const custom = new Map(snap.customLists.map((l) => [l.id, l]));
  const lists: ListView[] = listProgress(snap).map((l) => ({
    ...l,
    items:
      l.kind === "custom"
        ? (custom.get(l.id)?.slugs ?? []).map((slug) => {
            const status = statusOf(snap, slug);
            return {
              slug,
              title: snap.info(slug).title ?? slug,
              statusLabel: STATUS_LABELS[status],
              status,
            };
          })
        : [],
  }));
  return (
    <>
      <div className="page-head">
        <h1>Lists</h1>
        <span className="muted small">
          Active lists feed new problems into your daily queue, in this order.
        </span>
      </div>
      <ListManager lists={lists} activeLists={snap.settings.activeLists} />
    </>
  );
}
