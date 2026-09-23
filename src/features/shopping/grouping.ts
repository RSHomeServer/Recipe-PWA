import type { ShoppingLineView } from "./hooks";

export type ShoppingGroup = {
  key: string;
  label: string;
  sortOrder: number;
  lines: ShoppingLineView[];
};

export function groupByCategory(lines: ShoppingLineView[]): ShoppingGroup[] {
  const map = new Map<string, ShoppingGroup>();
  for (const line of lines) {
    const key = line.category?.id ?? "uncategorized";
    const label = line.category?.name ?? "Uncategorized";
    const sortOrder = line.category?.sortOrder ?? Number.POSITIVE_INFINITY;
    const existing = map.get(key);
    if (existing) {
      existing.lines.push(line);
    } else {
      map.set(key, { key, label, sortOrder, lines: [line] });
    }
  }
  for (const group of map.values()) {
    group.lines.sort((a, b) =>
      a.ingredient.name.localeCompare(b.ingredient.name, undefined, {
        sensitivity: "base",
      }),
    );
  }
  return [...map.values()].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
  });
}

export function groupByRecipe(
  lines: ShoppingLineView[],
  recipeNames: ReadonlyMap<string, string>,
): ShoppingGroup[] {
  const map = new Map<string, ShoppingGroup>();

  for (const line of lines) {
    if (line.sources.length === 0) {
      const key = line.isManual ? "manual" : "other";
      const label = line.isManual ? "Added manually" : "Other";
      const existing = map.get(key);
      if (existing) existing.lines.push(line);
      else map.set(key, { key, label, sortOrder: 9999, lines: [line] });
      continue;
    }

    // One line can appear under multiple recipes; duplicate into each group.
    const recipeIds = [
      ...new Set(line.sources.map((s) => s.recipeId ?? "ingredient")),
    ];
    for (const recipeId of recipeIds) {
      const key = recipeId;
      const label =
        recipeId === "ingredient"
          ? "Bare ingredients"
          : (recipeNames.get(recipeId) ?? "Unknown recipe");
      const sortOrder = recipeId === "ingredient" ? 9000 : 0;
      const existing = map.get(key);
      if (existing) existing.lines.push(line);
      else map.set(key, { key, label, sortOrder, lines: [line] });
    }
  }

  for (const group of map.values()) {
    group.lines.sort((a, b) =>
      a.ingredient.name.localeCompare(b.ingredient.name, undefined, {
        sensitivity: "base",
      }),
    );
  }

  return [...map.values()].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
  });
}
