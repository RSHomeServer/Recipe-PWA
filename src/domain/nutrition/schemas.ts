import { z } from "zod";
import {
  CanonicalQuantitySchema,
  MeasureKindSchema,
  UnitSchema,
} from "../units/schemas";

export const NutritionSchema = z.object({
  kcal: z.number().finite().nonnegative(),
  proteinG: z.number().finite().nonnegative(),
  carbsG: z.number().finite().nonnegative(),
  fatG: z.number().finite().nonnegative(),
  /** null = unknown (ADR-007); never treat as zero when summing. */
  sodiumMg: z.number().finite().nonnegative().nullable(),
});
export type Nutrition = z.infer<typeof NutritionSchema>;

/** Minimal ingredient shape for nutritionOf / recipe helpers. */
export const NutritionIngredientSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  measureKind: MeasureKindSchema,
  nutrition: NutritionSchema,
});
export type NutritionIngredient = z.infer<typeof NutritionIngredientSchema>;

export const RecipeLineInputSchema = z.object({
  id: z.string().min(1),
  ingredientId: z.string().min(1),
  quantity: CanonicalQuantitySchema,
  displayUnit: UnitSchema,
  optional: z.boolean(),
  note: z.string().nullable().optional(),
});
export type RecipeLineInput = z.infer<typeof RecipeLineInputSchema>;

export const RecipeInputSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  servings: z.number().finite().positive(),
  lines: z.array(RecipeLineInputSchema),
});
export type RecipeInput = z.infer<typeof RecipeInputSchema>;

export const BatchSnapshotLineSchema = z.object({
  ingredientId: z.string().min(1),
  ingredientName: z.string(),
  quantity: CanonicalQuantitySchema,
  nutrition: NutritionSchema,
});
export type BatchSnapshotLine = z.infer<typeof BatchSnapshotLineSchema>;

export const BatchSnapshotSchema = z.object({
  recipeName: z.string(),
  lines: z.array(BatchSnapshotLineSchema),
  total: NutritionSchema,
});
export type BatchSnapshot = z.infer<typeof BatchSnapshotSchema>;

/** Minimal batch shape for portion helpers. */
export const BatchNutritionInputSchema = z.object({
  portionsNominal: z.number().finite().positive(),
  snapshot: BatchSnapshotSchema,
});
export type BatchNutritionInput = z.infer<typeof BatchNutritionInputSchema>;

/**
 * Defensive normalize for pre-v3 nutrition objects (migration / backup).
 * Missing sodiumMg → null (unknown), never 0.
 */
export function normalizeNutrition(row: unknown): Nutrition | unknown {
  if (!row || typeof row !== "object") return row;
  const record = row as Record<string, unknown>;
  const sodiumRaw = record.sodiumMg;
  const sodiumMg =
    sodiumRaw === null
      ? null
      : typeof sodiumRaw === "number" &&
          Number.isFinite(sodiumRaw) &&
          sodiumRaw >= 0
        ? sodiumRaw
        : null;
  return {
    ...record,
    sodiumMg,
  };
}

/**
 * Walk batch / customFood-shaped rows and fill missing sodiumMg with null.
 * Does not invent figures; used so pre-v3 history stays readable at schema v3.
 */
export function normalizeNutritionDeep(row: unknown): unknown {
  if (!row || typeof row !== "object") return row;
  if (Array.isArray(row)) {
    return row.map((item) => normalizeNutritionDeep(item));
  }
  const record = row as Record<string, unknown>;
  const next: Record<string, unknown> = { ...record };
  if ("nutrition" in next) {
    next.nutrition = normalizeNutrition(next.nutrition);
  }
  if ("total" in next && next.total && typeof next.total === "object") {
    next.total = normalizeNutrition(next.total);
  }
  if ("snapshot" in next && next.snapshot && typeof next.snapshot === "object") {
    next.snapshot = normalizeNutritionDeep(next.snapshot);
  }
  if ("lines" in next && Array.isArray(next.lines)) {
    next.lines = next.lines.map((line) => normalizeNutritionDeep(line));
  }
  if ("entry" in next && next.entry && typeof next.entry === "object") {
    const entry = next.entry as Record<string, unknown>;
    if (entry.kind === "customFood" && entry.food) {
      next.entry = {
        ...entry,
        food: normalizeNutritionDeep(entry.food),
      };
    }
  }
  return next;
}
