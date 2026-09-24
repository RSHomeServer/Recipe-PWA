import type { ReactNode } from "react";
import { ChoiceGrid, type ChoiceGridOption } from "@/ui/choice-grid";
import { CommandPicker, type CommandPickerItem } from "@/ui/command-picker";
import { SegmentedGroup, type SegmentedOption } from "@/ui/segmented-group";

export type ChoiceOption = {
  value: string;
  label: string;
  helperText?: string;
  disabled?: boolean;
  disabledReason?: string;
  icon?: ReactNode;
  keywords?: string[];
  context?: ReactNode;
};

export type ChoiceProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly ChoiceOption[];
  /** Override automatic cardinality routing (ADR-005). */
  force?: "segmented" | "grid" | "palette";
  recentIds?: readonly string[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  title?: string;
  description?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
};

/**
 * Pick the control from option count (R5.1). Prefer explicit SegmentedGroup /
 * CommandPicker at call sites when cardinality is known; use this for dynamic lists.
 */
export function Choice({
  value,
  onValueChange,
  options,
  force,
  recentIds,
  placeholder,
  searchPlaceholder,
  emptyText,
  title,
  description,
  disabled,
  id,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
}: ChoiceProps) {
  const count = options.length;
  const mode =
    force ??
    (count <= 1
      ? "static"
      : count <= 6
        ? "segmented"
        : count <= 15
          ? "grid"
          : "palette");

  if (mode === "static") {
    const only = options[0];
    return (
      <p
        id={id}
        className={className}
        data-slot="choice-static"
        aria-label={ariaLabel}
      >
        {only?.label ?? "—"}
      </p>
    );
  }

  if (mode === "segmented") {
    const segmented: SegmentedOption[] = options.map((option) => ({
      value: option.value,
      label: option.label,
      helperText: option.helperText,
      disabled: option.disabled,
      disabledReason: option.disabledReason,
      icon: option.icon,
    }));
    return (
      <SegmentedGroup
        id={id}
        value={value}
        onValueChange={onValueChange}
        options={segmented}
        disabled={disabled}
        className={className}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
      />
    );
  }

  if (mode === "grid") {
    const grid: ChoiceGridOption[] = options.map((option) => ({
      value: option.value,
      label: option.label,
      disabled: option.disabled,
      disabledReason: option.disabledReason,
      icon: option.icon,
    }));
    return (
      <ChoiceGrid
        id={id}
        value={value}
        onValueChange={onValueChange}
        options={grid}
        disabled={disabled}
        className={className}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
      />
    );
  }

  const items: CommandPickerItem[] = options.map((option) => ({
    value: option.value,
    label: option.label,
    keywords: option.keywords,
    disabled: option.disabled,
    disabledReason: option.disabledReason,
    context: option.context,
  }));

  return (
    <CommandPicker
      id={id}
      value={value}
      onValueChange={onValueChange}
      items={items}
      recentIds={recentIds}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
      title={title}
      description={description}
      disabled={disabled}
      className={className}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
    />
  );
}
