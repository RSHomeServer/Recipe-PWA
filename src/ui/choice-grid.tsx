import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/ui/lib/utils";

export type ChoiceGridOption = {
  value: string;
  label: string;
  disabled?: boolean;
  disabledReason?: string;
  icon?: ReactNode;
};

export type ChoiceGridProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly ChoiceGridOption[];
  className?: string;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

/**
 * Cardinality 7–15 short labels (ADR-005): wrapping button grid, radiogroup semantics.
 */
export function ChoiceGrid({
  value,
  onValueChange,
  options,
  className,
  disabled,
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: ChoiceGridProps) {
  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      data-slot="choice-grid"
      className={cn("flex flex-wrap gap-2", className)}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        const isDisabled = disabled || option.disabled;
        const accessibleName = option.disabled
          ? `${option.label}${option.disabledReason ? ` — ${option.disabledReason}` : ""}`
          : option.label;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={accessibleName}
            disabled={isDisabled}
            title={
              option.disabled && option.disabledReason
                ? option.disabledReason
                : undefined
            }
            tabIndex={isSelected ? 0 : -1}
            onClick={() => {
              if (!isDisabled) onValueChange(option.value);
            }}
            onKeyDown={(event) => {
              if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "ArrowDown" && event.key !== "ArrowUp") {
                return;
              }
              event.preventDefault();
              const enabled = options.filter((o) => !(disabled || o.disabled));
              if (enabled.length === 0) return;
              const currentIndex = enabled.findIndex((o) => o.value === value);
              const delta =
                event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
              const next =
                enabled[
                  (currentIndex + delta + enabled.length) % enabled.length
                ]!;
              onValueChange(next.value);
              // Focus moves with selection via re-render tabIndex.
              queueMicrotask(() => {
                const root = event.currentTarget.parentElement;
                const nextEl = root?.querySelector<HTMLElement>(
                  `[role="radio"][aria-checked="true"]`,
                );
                nextEl?.focus();
              });
            }}
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
          </button>
        );
      })}
    </div>
  );
}
