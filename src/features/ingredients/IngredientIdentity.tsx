import type { IngredientCategory } from "@/domain";
import { cn } from "@/ui/lib/utils";
import { resolveCategoryVisual } from "@/features/ingredients/categoryVisual";

export type IngredientIdentitySize = "sm" | "md" | "lg";

const SIZE_CLASS: Record<IngredientIdentitySize, string> = {
  sm: "size-8",
  md: "size-14",
  lg: "size-20",
};

const ICON_CLASS: Record<IngredientIdentitySize, string> = {
  sm: "size-4",
  md: "size-6",
  lg: "size-8",
};

export type IngredientIdentityProps = {
  category: IngredientCategory | null | undefined;
  /** Object URL for an optional user photo; absent → category icon fills the slot. */
  imageUrl?: string | null;
  /** Used for photo alt when the slot is the sole name carrier; usually adjacent text exists. */
  name: string;
  size?: IngredientIdentitySize;
  className?: string;
  /** When true, photo uses name as alt; otherwise decorative (list rows). */
  labelled?: boolean;
};

/**
 * Fixed identity slot: user photo when present, otherwise category icon + accent.
 * Slot never collapses — lists stay aligned (DESIGN.md §11 / R2.11).
 */
export function IngredientIdentity({
  category,
  imageUrl,
  name,
  size = "md",
  className,
  labelled = false,
}: IngredientIdentityProps) {
  const { icon: Icon, accent } = resolveCategoryVisual(category);
  const hasPhoto = Boolean(imageUrl);

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-md)]",
        SIZE_CLASS[size],
        className,
      )}
      style={
        hasPhoto
          ? undefined
          : {
              color: `var(${accent})`,
              backgroundColor: `color-mix(in oklab, var(${accent}) 18%, transparent)`,
            }
      }
      aria-hidden={labelled ? undefined : true}
    >
      {hasPhoto ? (
        <img
          src={imageUrl!}
          alt={labelled ? name : ""}
          className="size-full object-cover"
        />
      ) : (
        <Icon className={ICON_CLASS[size]} aria-hidden="true" />
      )}
    </div>
  );
}
