import { useMemo, type ReactNode } from "react";
import type { Ingredient, IngredientCategory } from "@/domain";
import { IngredientIdentity } from "@/features/ingredients/IngredientIdentity";
import { useIngredientCategories } from "@/features/ingredients/hooks";
import {
  CommandPicker,
  type CommandPickerProps,
} from "@/ui/command-picker";

type IngredientPickerProps = Omit<CommandPickerProps, "items"> & {
  ingredients: readonly Ingredient[];
  /** Optional override; defaults to live categories from the DB. */
  categories?: readonly IngredientCategory[];
  /** Optional context renderer per ingredient (category, pantry qty, …). */
  contextFor?: (ingredient: Ingredient) => ReactNode;
};

/**
 * Ingredient CommandPicker with common-first / show-all behaviour (R2.9a)
 * and category identity icons (R2.11).
 */
export function IngredientPicker({
  ingredients,
  categories: categoriesProp,
  contextFor,
  ...pickerProps
}: IngredientPickerProps) {
  const liveCategories = useIngredientCategories();

  const categoriesById = useMemo(() => {
    const categories = categoriesProp ?? liveCategories ?? [];
    const map = new Map<string, IngredientCategory>();
    for (const category of categories) {
      map.set(category.id, category);
    }
    return map;
  }, [categoriesProp, liveCategories]);

  const items = useMemo(
    () =>
      ingredients
        .filter((ingredient) => ingredient.archivedAt == null)
        .map((ingredient) => {
          const category =
            ingredient.categoryId == null
              ? undefined
              : categoriesById.get(ingredient.categoryId);
          return {
            value: ingredient.id,
            label: ingredient.name,
            common: ingredient.common,
            keywords: [
              ingredient.name,
              ingredient.source.entryCode ?? "",
              ingredient.source.entryName ?? "",
              category?.name ?? "",
            ].filter(Boolean),
            leading: (
              <IngredientIdentity
                category={category}
                name={ingredient.name}
                size="sm"
              />
            ),
            context: contextFor
              ? contextFor(ingredient)
              : ingredient.measureKind,
          };
        }),
    [ingredients, categoriesById, contextFor],
  );

  return <CommandPicker {...pickerProps} items={items} />;
}
