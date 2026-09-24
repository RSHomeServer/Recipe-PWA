import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/ui/lib/utils";

export type SegmentedOption = {
  value: string;
  label: string;
  helperText?: string;
  disabled?: boolean;
  /** Included in the accessible name when the option is disabled. */
  disabledReason?: string;
  icon?: ReactNode;
};

export type SegmentedGroupProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SegmentedOption[];
  className?: string;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
};

/**
 * Cardinality 2–6 single choice (ADR-005 / R5.2–R5.5).
 * Radix ToggleGroup type=single → role=radiogroup, one tab stop, arrow keys.
 */
export function SegmentedGroup({
  value,
  onValueChange,
  options,
  className,
  disabled,
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
}: SegmentedGroupProps) {
  const selected = options.find((option) => option.value === value);
  const helperId = id ? `${id}-helper` : undefined;
  const describedBy = [ariaDescribedBy, selected?.helperText ? helperId : null]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <div className={cn("space-y-2", className)} data-slot="segmented-group">
      <ToggleGroup.Root
        type="single"
        id={id}
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          if (next) onValueChange(next);
        }}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={describedBy}
        className="flex flex-wrap gap-2"
      >
        {options.map((option) => {
          const isSelected = option.value === value;
          const accessibleName = option.disabled
            ? `${option.label}${option.disabledReason ? ` — ${option.disabledReason}` : ""}`
            : option.label;

          return (
            <ToggleGroup.Item
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              aria-label={accessibleName}
              title={
                option.disabled && option.disabledReason
                  ? option.disabledReason
                  : undefined
              }
              className={cn(
                "inline-flex min-h-11 min-w-11 flex-none items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium whitespace-normal break-words transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:cursor-not-allowed disabled:opacity-50",
                isSelected
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-muted)] text-[var(--color-accent)]"
                  : "border-border bg-[var(--color-surface-raised)] text-foreground hover:bg-muted",
              )}
            >
              {isSelected ? (
                <Check className="size-4 shrink-0" aria-hidden="true" />
              ) : null}
              {option.icon ? (
                <span className="shrink-0" aria-hidden="true">
                  {option.icon}
                </span>
              ) : null}
              <span>{option.label}</span>
            </ToggleGroup.Item>
          );
        })}
      </ToggleGroup.Root>
      {selected?.helperText ? (
        <p
          id={helperId}
          className="text-sm text-muted-foreground"
          data-slot="segmented-group-helper"
        >
          {selected.helperText}
        </p>
      ) : null}
    </div>
  );
}
