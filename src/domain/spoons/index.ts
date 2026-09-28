/**
 * Kitchen spoons as an entry-time conversion (ADR-008).
 * Not a unit family — never import these into domain/units.
 */

import { z } from "zod";
import type { Ingredient } from "../ingredients/schemas";
import type { CanonicalQuantity, Unit } from "../units/schemas";
import { UnitSchema } from "../units/schemas";
import { toCanonical } from "../units/convert";
import { formatQuantity } from "../units/format";
import type { RecipeLine, SpoonEntryHint } from "../recipes/schemas";

export const SpoonKindSchema = z.enum(["tsp", "tbsp"]);
export type SpoonKind = z.infer<typeof SpoonKindSchema>;

/** Entry affordance: real units plus optional cited spoons. */
export const EntryMeasureSchema = z.union([UnitSchema, SpoonKindSchema]);
export type EntryMeasure = z.infer<typeof EntryMeasureSchema>;

/** @deprecated Prefer EntryMeasure */
export type EntryUnit = EntryMeasure;
/** @deprecated Prefer EntryMeasureSchema */
export const EntryUnitSchema = EntryMeasureSchema;

export function isSpoonKind(value: string): value is SpoonKind {
  return value === "tsp" || value === "tbsp";
}

/** @deprecated Prefer isSpoonKind */
export const isSpoon = isSpoonKind;

export function gramsPerSpoon(
  ingredient: Pick<Ingredient, "measureKind" | "gramsPerTsp" | "gramsPerTbsp">,
  spoon: SpoonKind,
): number | null {
  if (ingredient.measureKind !== "mass") return null;
  const grams =
    spoon === "tsp" ? ingredient.gramsPerTsp : ingredient.gramsPerTbsp;
  if (grams == null || !(grams > 0) || !Number.isFinite(grams)) return null;
  return grams;
}

/**
 * Entry measures offered for an ingredient (R3.4).
 * Spoons appear only when mass + the corresponding cited weight is non-null.
 */
export function entryMeasuresFor(
  ingredient: Pick<Ingredient, "measureKind" | "gramsPerTsp" | "gramsPerTbsp">,
): EntryMeasure[] {
  if (ingredient.measureKind === "mass") {
    const measures: EntryMeasure[] = ["g", "kg"];
    if (gramsPerSpoon(ingredient, "tsp") != null) measures.push("tsp");
    if (gramsPerSpoon(ingredient, "tbsp") != null) measures.push("tbsp");
    return measures;
  }
  if (ingredient.measureKind === "volume") return ["ml", "L"];
  return ["item"];
}

/** Alias accepting a unitsForKind helper for tests. */
export function entryUnitsForIngredient(
  ingredient: Pick<Ingredient, "measureKind" | "gramsPerTsp" | "gramsPerTbsp">,
  unitsForKind: (kind: Ingredient["measureKind"]) => readonly Unit[],
): EntryMeasure[] {
  const base: EntryMeasure[] = [...unitsForKind(ingredient.measureKind)];
  if (ingredient.measureKind !== "mass") return base;
  if (gramsPerSpoon(ingredient, "tsp") != null) base.push("tsp");
  if (gramsPerSpoon(ingredient, "tbsp") != null) base.push("tbsp");
  return base;
}

export type ConvertEntryOk = {
  ok: true;
  canonical: CanonicalQuantity;
  entryHint: SpoonEntryHint | null;
  displayUnit: Unit;
};

export type ConvertEntryErr = {
  ok: false;
  message: string;
};

/** Convert spoons → canonical grams at the entry boundary (R3.5). */
export function spoonsToCanonical(
  spoons: number,
  spoon: SpoonKind,
  ingredient: Pick<
    Ingredient,
    "name" | "measureKind" | "gramsPerTsp" | "gramsPerTbsp"
  >,
): ConvertEntryOk | ConvertEntryErr {
  if (!(Number.isFinite(spoons) && spoons >= 0)) {
    return { ok: false, message: "Spoon quantity must be zero or more" };
  }
  if (ingredient.measureKind !== "mass") {
    return { ok: false, message: `${ingredient.name} is not measured by mass` };
  }
  const grams = gramsPerSpoon(ingredient, spoon);
  if (grams == null) {
    return {
      ok: false,
      message: `No cited ${spoon} weight for ${ingredient.name}`,
    };
  }
  return {
    ok: true,
    canonical: { amount: spoons * grams, kind: "mass" },
    entryHint: { spoons, spoon },
    displayUnit: "g",
  };
}

/**
 * Convert a form entry (unit or spoon) to stored canonical + optional hint.
 */
export function entryToCanonical(
  amount: number,
  measure: EntryMeasure,
  ingredient: Ingredient,
): ConvertEntryOk | ConvertEntryErr {
  if (isSpoonKind(measure)) {
    return spoonsToCanonical(amount, measure, ingredient);
  }
  const converted = toCanonical(
    { value: amount, unit: measure },
    ingredient.measureKind,
  );
  if (!converted.ok) {
    return {
      ok: false,
      message: `Use ${converted.allowed.join(" / ")} for ${ingredient.name}`,
    };
  }
  return {
    ok: true,
    canonical: converted.canonical,
    entryHint: null,
    displayUnit: measure,
  };
}

/**
 * Display-time only — never store kcalPerTsp / kcalPerTbsp (R3.7).
 */
export function kcalPerSpoon(
  ingredient: Pick<
    Ingredient,
    "nutrition" | "measureKind" | "gramsPerTsp" | "gramsPerTbsp"
  >,
  spoon: SpoonKind,
): number | null {
  const grams = gramsPerSpoon(ingredient, spoon);
  if (grams == null) return null;
  return (ingredient.nutrition.kcal * grams) / 100;
}

/**
 * Read-back: "2 tsp (4.6 g)" when entryHint is set; otherwise normal quantity.
 */
export function formatLineQuantity(
  line: Pick<RecipeLine, "quantity" | "displayUnit" | "entryHint">,
): string {
  const gramsLabel = formatQuantity(line.quantity, {
    displayUnit: line.displayUnit,
  });
  if (line.entryHint == null) return gramsLabel;
  const { spoons, spoon } = line.entryHint;
  return `${spoons} ${spoon} (${gramsLabel})`;
}

export function recipeHasSpoonEntry(
  lines: ReadonlyArray<Pick<RecipeLine, "entryHint">>,
): boolean {
  return lines.some((line) => line.entryHint != null);
}

/** Clear display-only entryHint for invariance checks (R3.6). */
export function clearEntryHints(
  recipeLines: readonly RecipeLine[],
): RecipeLine[] {
  return recipeLines.map((line) =>
    line.entryHint == null ? line : { ...line, entryHint: null },
  );
}

/** Stored displayUnit when the entry measure was a spoon. */
export function entryMeasureToDisplayUnit(measure: EntryMeasure): Unit {
  return isSpoonKind(measure) ? "g" : measure;
}
