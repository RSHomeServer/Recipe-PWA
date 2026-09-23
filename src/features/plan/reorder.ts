import type { PlannedMeal } from "@/domain";

/** Reassign dense 0..n-1 positions within a (date, slot) group. */
export function withDensePositions(meals: PlannedMeal[]): PlannedMeal[] {
  return meals.map((meal, index) =>
    meal.position === index ? meal : { ...meal, position: index },
  );
}

/**
 * Move `mealId` into `targetDate`/`targetSlotId` at `targetIndex`
 * (0-based among meals already in that slot, excluding the moving meal).
 * Returns every meal whose date/slot/position changed.
 */
export function movePlannedMeal(
  all: readonly PlannedMeal[],
  mealId: string,
  targetDate: string,
  targetSlotId: string,
  targetIndex: number,
): PlannedMeal[] {
  const moving = all.find((m) => m.id === mealId);
  if (!moving) return [];

  const others = all.filter((m) => m.id !== mealId);
  const sourceKey = `${moving.date}|${moving.slotId}`;
  const targetKey = `${targetDate}|${targetSlotId}`;

  const sourceSiblings = others
    .filter((m) => `${m.date}|${m.slotId}` === sourceKey)
    .sort((a, b) => a.position - b.position);

  const targetSiblings = others
    .filter((m) => `${m.date}|${m.slotId}` === targetKey)
    .sort((a, b) => a.position - b.position);

  const clamped = Math.max(0, Math.min(targetIndex, targetSiblings.length));
  const nextTarget = [...targetSiblings];
  nextTarget.splice(clamped, 0, {
    ...moving,
    date: targetDate,
    slotId: targetSlotId,
    position: clamped,
  });

  const updates = new Map<string, PlannedMeal>();

  for (const meal of withDensePositions(nextTarget)) {
    const prev = all.find((m) => m.id === meal.id)!;
    if (
      prev.date !== meal.date ||
      prev.slotId !== meal.slotId ||
      prev.position !== meal.position
    ) {
      updates.set(meal.id, meal);
    }
  }

  if (sourceKey !== targetKey) {
    for (const meal of withDensePositions(sourceSiblings)) {
      const prev = all.find((m) => m.id === meal.id)!;
      if (prev.position !== meal.position) {
        updates.set(meal.id, meal);
      }
    }
  }

  return [...updates.values()];
}
