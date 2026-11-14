/** Big-O values offered as one-tap chips. Anything else is free text. */
export const TIME_COMPLEXITIES = ["O(1)", "O(log n)", "O(n)", "O(n log n)", "O(n²)", "O(2ⁿ)"];
export const SPACE_COMPLEXITIES = ["O(1)", "O(log n)", "O(n)", "O(n²)"];

const SUPERSCRIPT: Record<string, string> = { "2": "²", "3": "³", n: "ⁿ", k: "ᵏ" };

/**
 * Normalise a Big-O string from a model or LeetCode ("O(N^2)", "O(n*log(n))", "NlogN") to the
 * notation the chips use ("O(n²)", "O(n log n)"). Undefined for an empty string.
 */
export function normalizeComplexity(raw: string | undefined): string | undefined {
  let s = raw?.trim();
  if (!s) return undefined;
  const wrapped = /^O\s*\((.*)\)$/i.exec(s);
  if (wrapped) s = wrapped[1]!.trim();
  if (!s) return undefined;

  s = s
    .replace(/log\s*\(\s*([^()]+?)\s*\)/gi, "log $1") // log(n) -> log n
    .replace(/log/gi, " log ") // NlogN -> N log N
    .replace(/\s*[*×·]\s*log/g, " log") // n * log n -> n log n
    .replace(/\s*[*×]\s*/g, "·") // n*m -> n·m
    .replace(/\s*\+\s*/g, " + ")
    .replace(/\s+/g, " ")
    .trim()
    // Single-letter variables are lower case, except V and E for graphs.
    .replace(/\b[A-Z]\b/g, (v) => (v === "V" || v === "E" ? v : v.toLowerCase()))
    .replace(/\^\s*\(?\s*([23nk])\s*\)?(?![\w(])/g, (_, p: string) => SUPERSCRIPT[p] ?? `^${p}`);
  return `O(${s})`;
}
