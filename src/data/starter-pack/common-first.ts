import type { Ingredient } from "@/domain";

export type CommonFirstPartition<T> = {
  /** Items to show before expanding. */
  visible: T[];
  /** Non-common matches hidden until the user expands. */
  hiddenCount: number;
  /** Total matches (common + non-common). */
  totalCount: number;
};

/**
 * Prefer `common` ingredients in pickers; hide the long tail behind
 * "show all N results" (R2.9a).
 */
export function partitionCommonFirst<T extends { common: boolean }>(
  items: readonly T[],
  options?: { showAll?: boolean },
): CommonFirstPartition<T> {
  const common = items.filter((item) => item.common);
  const rest = items.filter((item) => !item.common);
  const showAll = options?.showAll === true;
  if (showAll || rest.length === 0) {
    return {
      visible: [...common, ...rest],
      hiddenCount: 0,
      totalCount: items.length,
    };
  }
  return {
    visible: common,
    hiddenCount: rest.length,
    totalCount: items.length,
  };
}

/** Sort ingredients for list UIs: common first, then name. */
export function sortIngredientsCommonFirst(
  ingredients: readonly Ingredient[],
): Ingredient[] {
  return [...ingredients].sort((a, b) => {
    if (a.common !== b.common) return a.common ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}
