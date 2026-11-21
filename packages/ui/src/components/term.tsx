"use client";

import * as React from "react";
import { GLOSSARY, type GlossaryKey } from "#lib/glossary";
import { cn } from "#lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "#components/tooltip";

/**
 * A term with its meaning on hover, keyboard focus or a tap (dotted underline). Tooltips
 * don't open on touch by themselves, so a tap toggles it for phones. The text stays as
 * written; the explanation comes from the glossary, or `tip` for a one-off.
 */
export function Term({
  k,
  tip,
  children,
  className,
}: {
  k?: GlossaryKey;
  tip?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const text = tip ?? (k ? GLOSSARY[k] : "");
  const [open, setOpen] = React.useState(false);
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            data-slot="term"
            onClick={(e) => {
              // Stop the trigger's own close-on-click so a tap can open it.
              e.preventDefault();
              setOpen((o) => !o);
            }}
            className={cn(
              "cursor-help underline decoration-muted-foreground/60 decoration-dotted underline-offset-[3px] outline-none focus-visible:ring-2 focus-visible:ring-ring",
              className,
            )}
          >
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-72 leading-relaxed" sideOffset={4}>
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
