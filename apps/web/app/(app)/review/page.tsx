import { upcomingReviews } from "@leettrack/insights";
import { PageHead } from "@/components/PageHead";
import { loadSnapshot } from "@/lib/data";
import { formatDue } from "@/lib/util";
import { ReviewTable } from "./ReviewTable";

export const metadata = { title: "Review queue" };

/** Reviews due now and over the next two weeks, with bulk snooze and reschedule. */
export default async function ReviewPage() {
  const { snap } = await loadSnapshot();
  const rows = upcomingReviews(snap).map((r) => ({
    ...r,
    // Formatted here so the client renders what the server did.
    dueLabel: formatDue(r.due, snap.now),
  }));
  const dueNow = rows.filter((r) => r.isDue).length;
  return (
    <>
      <PageHead title="Review queue">
        {dueNow} due now · {rows.length - dueNow} more in the next two weeks
      </PageHead>
      <ReviewTable rows={rows} />
    </>
  );
}
