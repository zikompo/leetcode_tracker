import { z } from "zod";
import type { Difficulty } from "@leettrack/core";
import { problemUrl } from "./url";

export interface ProblemMetadata {
  slug: string;
  frontendId: string;
  title: string;
  difficulty: Difficulty;
  url: string;
  leetcodeTopics: string[];
  isPaidOnly: boolean;
}

// Verified against leetcode.com/graphql on 2026-11-14.
const QUERY = `query leettrackQuestion($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionFrontendId
    title
    titleSlug
    difficulty
    isPaidOnly
    topicTags { name slug }
  }
}`;

const responseSchema = z.object({
  data: z.object({
    question: z
      .object({
        questionFrontendId: z.string(),
        title: z.string(),
        titleSlug: z.string(),
        difficulty: z.enum(["Easy", "Medium", "Hard"]),
        isPaidOnly: z.boolean().optional(),
        topicTags: z
          .array(z.object({ name: z.string(), slug: z.string() }))
          .nullable()
          .optional(),
      })
      .nullable(),
  }),
});

export function parseMetadataResponse(json: unknown): ProblemMetadata | null {
  const parsed = responseSchema.safeParse(json);
  const q = parsed.success ? parsed.data.data.question : null;
  if (!q) return null;
  return {
    slug: q.titleSlug,
    frontendId: q.questionFrontendId,
    title: q.title,
    difficulty: q.difficulty,
    url: problemUrl(q.titleSlug),
    leetcodeTopics: (q.topicTags ?? []).map((t) => t.name),
    isPaidOnly: q.isPaidOnly ?? false,
  };
}

/** Fetch metadata from LeetCode's GraphQL endpoint. Must run on a leetcode.com page (same origin). */
export async function fetchProblemMetadata(
  slug: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ProblemMetadata | null> {
  const csrf = /(?:^|;\s*)csrftoken=([^;]+)/.exec(document.cookie)?.[1];
  const res = await fetchImpl("https://leetcode.com/graphql/", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", ...(csrf ? { "x-csrftoken": csrf } : {}) },
    body: JSON.stringify({
      operationName: "leettrackQuestion",
      query: QUERY,
      variables: { titleSlug: slug },
    }),
  });
  if (!res.ok) return null;
  return parseMetadataResponse(await res.json());
}
