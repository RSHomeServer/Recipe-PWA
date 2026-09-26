import type { ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  ChefHat,
  CircleDashed,
  Leaf,
  Utensils,
} from "lucide-react";
import { cn } from "@/ui/lib/utils";

export type QuantityProps = {
  amount: string | number;
  unit?: string;
  className?: string;
};

export function Quantity({ amount, unit, className }: QuantityProps) {
  return (
    <span data-slot="quantity" className={cn("num inline-flex items-baseline gap-1", className)}>
      <span className="font-medium text-foreground">{amount}</span>
      {unit ? (
        <span className="text-sm text-muted-foreground">{unit}</span>
      ) : null}
    </span>
  );
}

export type NutritionSummaryProps = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** When undefined, sodium is omitted. null → "Sodium not known". */
  sodiumMg?: number | null;
  variant?: "inline" | "row" | "block";
  className?: string;
};

export function NutritionSummary({
  kcal,
  protein,
  carbs,
  fat,
  sodiumMg,
  variant = "inline",
  className,
}: NutritionSummaryProps) {
  const sodiumLabel =
    sodiumMg === undefined
      ? null
      : sodiumMg === null
        ? "Sodium not known"
        : `${Math.round(sodiumMg)} mg Na`;

  const figures = (
    <>
      <span className="num font-medium">{kcal} kcal</span>
      <span className="text-muted-foreground">·</span>
      <span className="num text-[var(--color-macro-protein)]">P {protein.toFixed(1)} g</span>
      <span className="text-muted-foreground">·</span>
      <span className="num text-[var(--color-macro-carbs)]">C {carbs.toFixed(1)} g</span>
      <span className="text-muted-foreground">·</span>
      <span className="num text-[var(--color-macro-fat)]">F {fat.toFixed(1)} g</span>
      {sodiumLabel ? (
        <>
          <span className="text-muted-foreground">·</span>
          <span className="num text-muted-foreground">{sodiumLabel}</span>
        </>
      ) : null}
    </>
  );

  if (variant === "block") {
    return (
      <div
        data-slot="nutrition-summary"
        className={cn("flex flex-col gap-2 text-base", className)}
      >
        <div className="num font-display text-2xl font-semibold">{kcal} kcal</div>
        <div className="flex flex-wrap gap-3 text-sm">{figures}</div>
      </div>
    );
  }

  if (variant === "row") {
    return (
      <div
        data-slot="nutrition-summary"
        className={cn("flex flex-wrap items-center gap-2 text-base", className)}
      >
        {figures}
      </div>
    );
  }

  return (
    <span
      data-slot="nutrition-summary"
      className={cn("inline-flex flex-wrap items-center gap-2 text-sm", className)}
    >
      {figures}
    </span>
  );
}

export type MacroBarSegment = {
  key: "energy" | "protein" | "carbs" | "fat" | "none";
  value: number;
  label: string;
};

export type MacroBarProps = {
  segments: MacroBarSegment[];
  className?: string;
};

const macroToken: Record<MacroBarSegment["key"], string> = {
  energy: "var(--color-macro-energy)",
  protein: "var(--color-macro-protein)",
  carbs: "var(--color-macro-carbs)",
  fat: "var(--color-macro-fat)",
  none: "var(--color-macro-none)",
};

export function MacroBar({ segments, className }: MacroBarProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;

  return (
    <div data-slot="macro-bar" className={cn("space-y-2", className)}>
      <div
        className="flex h-2 w-full overflow-hidden rounded-sm bg-muted"
        role="img"
        aria-label="Macro proportion bar"
      >
        {segments.map((segment) => (
          <div
            key={segment.key}
            style={{
              width: `${(segment.value / total) * 100}%`,
              backgroundColor: macroToken[segment.key],
            }}
            title={`${segment.label}: ${segment.value}`}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-3 text-sm">
        {segments.map((segment) => (
          <li key={segment.key} className="flex items-center gap-2">
            <span
              className="size-2.5 rounded-xs"
              style={{ backgroundColor: macroToken[segment.key] }}
              aria-hidden="true"
            />
            <span>{segment.label}</span>
            <span className="num text-muted-foreground">{segment.value}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type AvailabilityState = "canMake" | "almostCanMake" | "missingSignificant";

export type AvailabilityIndicatorProps = {
  state: AvailabilityState;
  shortfalls?: string[];
  className?: string;
};

const availabilityCopy: Record<
  AvailabilityState,
  { label: string; token: string; Icon: typeof Check }
> = {
  canMake: {
    label: "Ready to cook",
    token: "var(--color-success)",
    Icon: Check,
  },
  almostCanMake: {
    label: "Almost",
    token: "var(--color-warning)",
    Icon: AlertTriangle,
  },
  missingSignificant: {
    label: "Missing items",
    token: "var(--color-muted)",
    Icon: CircleDashed,
  },
};

export function AvailabilityIndicator({
  state,
  shortfalls = [],
  className,
}: AvailabilityIndicatorProps) {
  const { label, token, Icon } = availabilityCopy[state];

  return (
    <div data-slot="availability-indicator" className={cn("space-y-1 text-sm", className)}>
      <div className="flex items-center gap-2 font-medium" style={{ color: token }}>
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </div>
      {shortfalls.length > 0 ? (
        <ul className="text-muted-foreground">
          {shortfalls.map((item) => (
            <li key={item}>Missing: {item}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export type PortionStepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
};

export function PortionStepper({
  value,
  onChange,
  min = 0,
  max = 99,
  step = 0.5,
  className,
}: PortionStepperProps) {
  const decrement = () => onChange(Math.max(min, +(value - step).toFixed(1)));
  const increment = () => onChange(Math.min(max, +(value + step).toFixed(1)));

  return (
    <div
      data-slot="portion-stepper"
      className={cn("inline-flex items-center gap-2", className)}
    >
      <button
        type="button"
        className="inline-flex size-12 items-center justify-center rounded-md border border-border bg-background text-lg font-medium"
        aria-label="Decrease portion"
        onClick={decrement}
      >
        −
      </button>
      <span className="num min-w-12 text-center text-lg font-medium">{value}</span>
      <button
        type="button"
        className="inline-flex size-12 items-center justify-center rounded-md border border-border bg-background text-lg font-medium"
        aria-label="Increase portion"
        onClick={increment}
      >
        +
      </button>
    </div>
  );
}

export type IngredientChipProps = {
  label: string;
  stocked?: boolean;
  className?: string;
};

export function IngredientChip({ label, stocked = true, className }: IngredientChipProps) {
  return (
    <span
      data-slot="ingredient-chip"
      className={cn(
        "inline-flex min-h-8 items-center rounded-sm px-3 text-sm font-medium",
        stocked
          ? "bg-accent text-accent-foreground"
          : "border border-border bg-background text-muted-foreground",
        className,
      )}
    >
      {label}
    </span>
  );
}

export type PlanSlotTileVariant = "cook" | "portion" | "ingredient";
export type PlanSlotTileDensity = "comfortable" | "compact";

export type PlanSlotTileProps = {
  title: string;
  subtitle?: string;
  variant: PlanSlotTileVariant;
  /** Week grid uses compact; composer / mobile day / log use comfortable (default). */
  density?: PlanSlotTileDensity;
  className?: string;
  children?: ReactNode;
};

const PLAN_TILE_META: Record<
  PlanSlotTileVariant,
  {
    label: string;
    hint: string;
    surface: string;
    iconWrap: string;
    Icon: typeof ChefHat;
  }
> = {
  cook: {
    label: "Cook a recipe",
    hint: "You'll cook this fresh — ingredients go on the shopping list",
    surface:
      "border-2 border-[var(--color-accent)] bg-[var(--color-surface-raised)]",
    iconWrap: "bg-accent text-primary-foreground",
    Icon: ChefHat,
  },
  portion: {
    label: "From a batch",
    hint: "A portion you already cooked — nothing to buy",
    surface:
      "border border-[var(--color-border-subtle)] bg-[var(--color-surface-sunken)]",
    iconWrap: "bg-muted text-muted-foreground",
    Icon: Utensils,
  },
  ingredient: {
    label: "Eat or heat one item",
    hint: "One thing from the pack — quantity goes on the shopping list",
    surface: "border border-dashed border-border bg-background",
    iconWrap: "bg-[var(--color-surface-raised)] text-foreground",
    Icon: Leaf,
  },
};

export function PlanSlotTile({
  title,
  subtitle,
  variant,
  density = "comfortable",
  className,
  children,
}: PlanSlotTileProps) {
  const meta = PLAN_TILE_META[variant];
  const Icon = meta.Icon;
  const compact = density === "compact";

  return (
    <article
      data-slot="plan-slot-tile"
      data-variant={variant}
      data-density={density}
      className={cn(
        "min-w-0 max-w-full overflow-hidden rounded-lg",
        compact ? "p-2" : "p-3",
        meta.surface,
        className,
      )}
    >
      <div className={cn("flex items-start gap-2.5", compact && "gap-2")}>
        <span
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-md",
            compact ? "size-7" : "size-8",
            meta.iconWrap,
          )}
          aria-hidden="true"
        >
          <Icon className={compact ? "size-3.5" : "size-4"} />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p
            className={cn(
              "truncate font-display font-semibold leading-snug",
              compact ? "text-sm" : "text-base",
            )}
          >
            {title}
          </p>
          {!compact && subtitle ? (
            <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
          <p className="sr-only">
            {meta.label}. {meta.hint}
            {compact && subtitle ? ` ${subtitle}` : null}
          </p>
          {children}
        </div>
      </div>
    </article>
  );
}

export type MealSlotSectionProps = {
  slotLabel: string;
  children: ReactNode;
  className?: string;
};

export function MealSlotSection({ slotLabel, children, className }: MealSlotSectionProps) {
  return (
    <section
      data-slot="meal-slot-section"
      className={cn("min-w-0 space-y-2", className)}
    >
      <h3 className="text-sm font-semibold text-muted-foreground">{slotLabel}</h3>
      <div className="min-w-0 space-y-2">{children}</div>
    </section>
  );
}

export type AttributionItem = {
  name: string;
  percent: number;
};

export type AttributionListProps = {
  items: AttributionItem[];
  className?: string;
};

export function AttributionList({ items, className }: AttributionListProps) {
  return (
    <ol data-slot="attribution-list" className={cn("space-y-2", className)}>
      {items.map((item) => (
        <li key={item.name} className="flex items-center justify-between gap-4 text-base">
          <span>{item.name}</span>
          <span className="num font-mono text-sm text-muted-foreground">{item.percent}%</span>
        </li>
      ))}
    </ol>
  );
}

export type TargetReadoutProps = {
  /** When null/undefined, renders nothing — no nag. */
  target?: number | null;
  consumed: number;
  /** Slim horizontal meter (4–6px). Default true. */
  showMeter?: boolean;
  className?: string;
};

export function TargetReadout({
  target,
  consumed,
  showMeter = true,
  className,
}: TargetReadoutProps) {
  if (target == null || !Number.isFinite(target) || target <= 0) return null;

  const remainingKcal = target - consumed;
  const remainingLabel =
    remainingKcal >= 0
      ? `Remaining ${Math.round(remainingKcal)}`
      : `${Math.round(Math.abs(remainingKcal))} over`;
  const fillRatio = Math.min(1, Math.max(0, consumed / target));

  return (
    <div data-slot="target-readout" className={cn("space-y-2", className)}>
      <p className="num flex flex-wrap items-baseline gap-x-3 gap-y-1 text-base text-foreground">
        <span>
          Target <strong className="font-semibold">{Math.round(target)}</strong>
        </span>
        <span aria-hidden="true" className="text-muted-foreground">
          ·
        </span>
        <span>
          Consumed <strong className="font-semibold">{Math.round(consumed)}</strong>
        </span>
        <span aria-hidden="true" className="text-muted-foreground">
          ·
        </span>
        <span>
          {remainingLabel} <span className="text-muted-foreground">kcal</span>
        </span>
      </p>
      {showMeter ? (
        <div
          className="h-1.5 w-full overflow-hidden rounded-sm bg-muted"
          role="img"
          aria-label={`Consumed ${Math.round(consumed)} of ${Math.round(target)} kcal`}
        >
          <div
            className="h-full rounded-sm bg-[var(--color-accent)]"
            style={{ width: `${fillRatio * 100}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

export type ShortfallNoticeProps = {
  message: string;
  onAdjustPantry?: () => void;
  onCookAnyway?: () => void;
  className?: string;
};

export function ShortfallNotice({
  message,
  onAdjustPantry,
  onCookAnyway,
  className,
}: ShortfallNoticeProps) {
  return (
    <div
      data-slot="shortfall-notice"
      role="status"
      className={cn(
        "rounded-lg border border-border bg-[var(--color-warning-muted)]/30 p-4 space-y-3",
        className,
      )}
    >
      <p className="text-base text-foreground">{message}</p>
      <div className="flex flex-wrap gap-2">
        {onAdjustPantry ? (
          <button
            type="button"
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium"
            onClick={onAdjustPantry}
          >
            Adjust pantry
          </button>
        ) : null}
        {onCookAnyway ? (
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            onClick={onCookAnyway}
          >
            Cook anyway
          </button>
        ) : null}
      </div>
    </div>
  );
}

export type DateRangeControlProps = {
  label: string;
  onPrevious?: () => void;
  onNext?: () => void;
  /** Replace the default label button (e.g. PopoverTrigger). */
  labelSlot?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function DateRangeControl({
  label,
  onPrevious,
  onNext,
  labelSlot,
  children,
  className,
}: DateRangeControlProps) {
  return (
    <div
      data-slot="date-range-control"
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      {onPrevious ? (
        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-md border border-border"
          aria-label="Previous week"
          onClick={onPrevious}
        >
          ←
        </button>
      ) : null}
      {labelSlot ?? (
        <button
          type="button"
          className="rounded-md border border-border bg-background px-4 py-2 text-base font-medium"
        >
          {label}
        </button>
      )}
      {onNext ? (
        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-md border border-border"
          aria-label="Next week"
          onClick={onNext}
        >
          →
        </button>
      ) : null}
      {children}
    </div>
  );
}
