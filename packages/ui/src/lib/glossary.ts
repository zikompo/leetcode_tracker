/** Plain-language meanings for LeetTrack's terms, shown on hover (one place to edit them). */
export const GLOSSARY = {
  recall:
    "The scheduler's estimate of how likely you are to solve this again from memory today. It falls over time; the problem comes back for review when it drops to your target recall (90% by default).",
  stability:
    "Roughly how many days your memory of this problem lasts before recall falls to 90%. Each good review makes it longer.",
  retention:
    "How well you'd recall the problems you've solved in this pattern right now, weighted by difficulty and by how cleanly you solved them.",
  coldSolve:
    "Of your first attempts at this pattern's problems, the share you solved on your own, with no help. The best sign you can spot the pattern fresh, as in an interview.",
  coverage: "The share of this pattern's problems in your active lists that you've attempted.",
  mastery: "One score for the pattern: 50% retention, 30% cold-solve and 20% coverage.",
  toDo: "Reviews due today plus the new problems queued for today.",
  lastRating:
    "How your latest attempt at each problem went, as you rated it: Again (couldn't do it), Hard, Good or Easy. The bright part of each arc is what's due today.",
  leech:
    "A problem rated Again three or more times. Worth slowing down on: your stuck notes show what keeps tripping you up.",
  coldGap:
    "Patterns where you can re-solve problems you've seen before, but rarely spot the pattern on a first try.",
  moved:
    "Its review date was set by hand (snoozed or moved). The normal schedule takes over again after the next review.",
  overdue:
    "Past its review date. Overdue problems come first; they're the ones you're most likely to be forgetting.",
  extraReview:
    "A problem you'd likely be shaky on by the interview, brought forward for one more review a few days before.",
  steadyPace:
    "Where you'd be if you started the same number of new problems each day until new problems stop before the interview.",
  quick:
    "A quick review: recall the approach and complexity and rate yourself, without re-solving it. Offered once a problem is well learned.",
  streak: "Days in a row with at least one attempt logged. Today counts once you log something.",
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;
