import type { AttemptSession } from "./types";

/**
 * Combine a session restored from storage with one started in memory while it loaded (a
 * submission can arrive in that window). Nothing the live one recorded is lost; its clock
 * and checkpoints continue from where the stored one left off.
 */
export function mergeSessions(
  stored: AttemptSession | null,
  live: AttemptSession | null,
): AttemptSession | null {
  if (!stored || !live) return stored ?? live;
  // The same session saved and read back: the in-memory copy is the newer one.
  if (stored.startedAt === live.startedAt) return live;
  const offset = stored.activeSeconds;
  const seen = new Set(stored.submissionIds);
  const language = live.language ?? stored.language;
  const code = live.code ?? stored.code;
  const stoppedAt = live.stoppedAt ?? stored.stoppedAt;
  const checkpoints = [
    ...(stored.checkpoints ?? []),
    ...(live.checkpoints ?? []).map((c) => ({ ...c, activeSeconds: c.activeSeconds + offset })),
  ];
  return {
    ...stored,
    lastActiveAt: live.lastActiveAt,
    activeSeconds: stored.activeSeconds + live.activeSeconds,
    submissions: [...stored.submissions, ...live.submissions],
    submissionIds: [...stored.submissionIds, ...live.submissionIds.filter((id) => !seen.has(id))],
    viewedSolutionDetected: stored.viewedSolutionDetected || live.viewedSolutionDetected,
    ...(language ? { language } : {}),
    ...(code !== undefined ? { code } : {}),
    ...(stoppedAt ? { stoppedAt } : {}),
    ...(checkpoints.length ? { checkpoints } : {}),
  };
}
