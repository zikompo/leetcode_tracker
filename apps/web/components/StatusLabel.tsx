import { CircleCheck, CircleDashed, CircleDot, Sparkles } from "lucide-react";
import type { ProblemStatus } from "@leettrack/core";
import { cn } from "@leettrack/ui/lib/utils";

const LOOK: Record<ProblemStatus, { icon: typeof CircleCheck; className: string }> = {
  unseen: { icon: CircleDashed, className: "text-muted-foreground" },
  in_progress: { icon: CircleDot, className: "text-warn" },
  solved_with_help: { icon: CircleDot, className: "text-medium" },
  fully_solved: { icon: CircleCheck, className: "text-ok" },
  mastered: { icon: Sparkles, className: "text-primary" },
};

/** A problem's status with an icon, LeetCode-list style. The text carries the meaning. */
export function StatusLabel({ status, label }: { status: ProblemStatus; label: string }) {
  const { icon: Icon, className } = LOOK[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap">
      <Icon className={cn("size-3.5 shrink-0", className)} aria-hidden />
      <span data-slot="status">{label}</span>
    </span>
  );
}
