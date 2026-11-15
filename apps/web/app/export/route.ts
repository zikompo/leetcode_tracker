import { buildExport } from "@leettrack/core";
import { getViewer, loadDataSet } from "@/lib/data";

/** Everything as one JSON file, in the same format the extension imports and exports. */
export async function GET() {
  if (!(await getViewer())) return new Response("Sign in first.", { status: 401 });
  const data = await loadDataSet();
  const file = buildExport({
    problems: [...data.problems],
    attempts: [...data.attempts],
    settings: data.settings,
    customLists: [...(data.customLists ?? [])],
  });
  return new Response(JSON.stringify(file, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="leettrack-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
