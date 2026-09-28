import type { EntryMeasure, Unit } from "@/domain";
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

const ENTRY_LABELS: Record<EntryMeasure, string> = {
  g: "g",
  kg: "kg",
  ml: "ml",
  L: "L",
  item: "×",
  tsp: "tsp",
  tbsp: "tbsp",
};

export type EntryMeasureChoiceProps = {
  measures: readonly EntryMeasure[];
  value: EntryMeasure;
  onValueChange: (measure: EntryMeasure) => void;
  id?: string;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
};

/** Quantity entry measure — real units plus optional cited spoons (ADR-008). */
export function EntryMeasureChoice({
  measures,
  value,
  onValueChange,
  id,
  disabled,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  className,
}: EntryMeasureChoiceProps) {
  return (
    <Choice
      id={id}
      value={value}
      onValueChange={(next) => {
        if (measures.includes(next as EntryMeasure)) {
          onValueChange(next as EntryMeasure);
        }
      }}
      options={measures.map((measure) => ({
        value: measure,
        label: ENTRY_LABELS[measure],
      }))}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={className}
    />
  );
}
