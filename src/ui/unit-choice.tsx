import type { Unit } from "@/domain";
import { Choice } from "@/ui/choice";

export type UnitChoiceProps = {
  units: readonly Unit[];
  value: Unit;
  onValueChange: (unit: Unit) => void;
  id?: string;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
};

/** In-family unit pick — cardinality usually 1–3 (R5.1). */
export function UnitChoice({
  units,
  value,
  onValueChange,
  id,
  disabled,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  className,
}: UnitChoiceProps) {
  return (
    <Choice
      id={id}
      value={value}
      onValueChange={(next) => onValueChange(next as Unit)}
      options={units.map((unit) => ({ value: unit, label: unit }))}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={className}
    />
  );
}
