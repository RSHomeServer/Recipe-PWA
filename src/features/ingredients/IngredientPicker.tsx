import { useMemo, type ReactNode } from "react";
import type { Ingredient } from "@/domain";
import {
  CommandPicker,
  type CommandPickerProps,
} from "@/ui/command-picker";

type IngredientPickerProps = Omit<CommandPickerProps, "items"> & {
  ingredients: readonly Ingredient[];
  /** Optional context renderer per ingredient (category, pantry qty, …). */
  contextFor?: (ingredient: Ingredient) => ReactNode;
};

/**
 * Ingredient CommandPicker with common-first / show-all behaviour (R2.9a).
 */
export function IngredientPicker({
  ingredients,
  contextFor,
  ...pickerProps
}: IngredientPickerProps) {
  const items = useMemo(
    () =>
      ingredients
        .filter((ingredient) => ingredient.archivedAt == null)
        .map((ingredient) => ({
          value: ingredient.id,
          label: ingredient.name,
          common: ingredient.common,
          keywords: [
            ingredient.name,
            ingredient.source.entryCode ?? "",
            ingredient.source.entryName ?? "",
          ].filter(Boolean),
          context: contextFor
            ? contextFor(ingredient)
            : ingredient.measureKind,
        })),
    [ingredients, contextFor],
  );

  return <CommandPicker {...pickerProps} items={items} />;
}
