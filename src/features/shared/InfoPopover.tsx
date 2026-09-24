import { CircleHelp } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover";
import { cn } from "@/ui/lib/utils";

export type InfoPopoverProps = {
  label: string;
  children: ReactNode;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
};

/**
 * 44px info control opening a Popover (ADR-003 §5 / DESIGN.md §6.3).
 * Not a Tooltip — works on touch and by keyboard.
 */
export function InfoPopover({
  label,
  children,
  className,
  side = "bottom",
}: InfoPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("size-11 shrink-0 text-muted-foreground", className)}
          aria-label={label}
        >
          <CircleHelp className="size-5" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side={side} align="start" className="text-base leading-relaxed">
        {children}
      </PopoverContent>
    </Popover>
  );
}
