import { useMemo, type ReactNode } from "react";
import type { Ingredient, IngredientCategory } from "@/domain";
import { IngredientIdentity } from "@/features/ingredients/IngredientIdentity";
import { useIngredientCategories } from "@/features/ingredients/hooks";
import {
  CommandPicker,
  type CommandPickerProps,
} from "@/ui/command-picker";
import displayAliases from "@/data/flavour-pack/display-aliases.json";

type IngredientPickerProps = Omit<CommandPickerProps, "items"> & {
  ingredients: readonly Ingredient[];
  /** Optional override; defaults to live categories from the DB. */
  categories?: readonly IngredientCategory[];
  /** Optional context renderer per ingredient (category, pantry qty, …). */
  contextFor?: (ingredient: Ingredient) => ReactNode;
};

type DisplayAlias = {
  alias: string;
  datasetId: string;
  entryCode: string;
  displayName: string;
};

const ALIASES = displayAliases.aliases as DisplayAlias[];

function aliasesForIngredient(ingredient: Ingredient): string[] {
  const datasetId = ingredient.source.datasetId;
  const entryCode = ingredient.source.entryCode;
  if (!datasetId || !entryCode) return [];
  return ALIASES.filter(
    (row) => row.datasetId === datasetId && row.entryCode === entryCode,
  ).map((row) => row.alias);
}

/**
 * Ingredient CommandPicker with common-first / show-all behaviour (R2.9a)
 * and category identity icons (R2.11). Display aliases (e.g. smoked paprika →
 * Paprika) are searchable keywords only — not second ingredients.
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
          const aliasKeywords = aliasesForIngredient(ingredient);
          return {
            value: ingredient.id,
            label: ingredient.name,
            common: ingredient.common,
            keywords: [
              ingredient.name,
              ingredient.source.entryCode ?? "",
              ingredient.source.entryName ?? "",
              category?.name ?? "",
              ingredient.notes ?? "",
              ...aliasKeywords,
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
