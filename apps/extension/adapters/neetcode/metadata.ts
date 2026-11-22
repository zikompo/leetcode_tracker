import { seedForNeetcodeSlug } from "@leettrack/seed";
import { z } from "zod";
import { problemUrl, type ProblemMetadata } from "../leetcode";
import { neetcodeProblemUrl } from "./url";

/**
 * LeetTrack keys problems by LeetCode slug. NeetCode's lists say which LeetCode problem each of
 * theirs is; any other NeetCode problem keeps its NeetCode slug, which usually matches anyway.
 */
export const leettrackSlugFor = (neetcodeSlug: string) =>
  seedForNeetcodeSlug(neetcodeSlug)?.slug ?? neetcodeSlug;

// Read from neetcode.io on 2026-11-21: POST /api/getProblemMetadataFunctionHttp with
// {data: {problemId}} → {data: {name, difficulty, topics, ...}}. Only these fields are kept;
// the description and solutions in the response are ignored.
const responseSchema = z.object({
  data: z.object({
    name: z.string(),
    difficulty: z.enum(["Easy", "Medium", "Hard"]),
    topics: z.array(z.string()).optional(),
  }),
});

/**
 * Metadata for a NeetCode problem, from NeetCode itself (same origin as the page). Problems in
 * NeetCode's lists take the LeetCode number, title and link from the seed; NeetCode's topics are
 * LeetCode's tag names.
 */
export async function fetchNeetcodeMetadata(
  neetcodeSlug: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ProblemMetadata | null> {
  let parsed: z.infer<typeof responseSchema> | null = null;
  try {
    const res = await fetchImpl("/api/getProblemMetadataFunctionHttp", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: { problemId: neetcodeSlug } }),
    });
    if (res.ok) parsed = responseSchema.safeParse(await res.json()).data ?? null;
  } catch {
    parsed = null;
  }
  if (!parsed) return null;
  const { name, difficulty, topics = [] } = parsed.data;
  const seed = seedForNeetcodeSlug(neetcodeSlug);
  if (seed)
    return {
      slug: seed.slug,
      frontendId: seed.frontendId,
      title: seed.title,
      difficulty: seed.difficulty,
      url: problemUrl(seed.slug),
      leetcodeTopics: topics,
      isPaidOnly: false,
    };
  return {
    slug: neetcodeSlug,
    frontendId: "",
    title: name,
    difficulty,
    url: neetcodeProblemUrl(neetcodeSlug),
    leetcodeTopics: topics,
    isPaidOnly: false,
  };
}
