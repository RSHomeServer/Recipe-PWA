import { z } from "zod";
import { NutritionSchema, normalizeNutrition } from "../nutrition/schemas";
import { MeasureKindSchema } from "../units/schemas";
import {
  IdSchema,
  IsoDateSchema,
  IsoDateTimeSchema,
} from "../shared/primitives";

export const IngredientSourceKindSchema = z.enum([
  "reference",
  "packaging",
  "userEntered",
  "estimated",
]);
export type IngredientSourceKind = z.infer<typeof IngredientSourceKindSchema>;

/** Origin fields are write-once once the ingredient exists (ADR-002). */
export const IngredientSourceSchema = z.object({
  kind: IngredientSourceKindSchema,
  datasetId: z.string().min(1).nullable(),
  datasetName: z.string().min(1).nullable(),
  entryCode: z.string().min(1).nullable(),
  entryName: z.string().min(1).nullable(),
  licence: z.string().min(1).nullable(),
  url: z.string().min(1).nullable(),
  retrievedAt: IsoDateSchema.nullable(),
  note: z.string().nullable(),
});
export type IngredientSource = z.infer<typeof IngredientSourceSchema>;

export const ORIGIN_FIELD_KEYS = [
  "datasetId",
  "datasetName",
  "entryCode",
  "entryName",
  "licence",
  "url",
  "retrievedAt",
] as const satisfies ReadonlyArray<keyof IngredientSource>;

export function defaultUserEnteredSource(
  note: string | null = null,
): IngredientSource {
  return {
    kind: "userEntered",
    datasetId: null,
    datasetName: null,
    entryCode: null,
    entryName: null,
    licence: null,
    url: null,
    retrievedAt: null,
    note,
  };
}

/** V3 — ADR-009. Closed sensory vocabulary; empty valid, null not. */
export const FlavourTagSchema = z.enum([
  "sweet",
  "sour",
  "salty",
  "umami",
  "spicy",
  "bitter",
  "smoky",
  "aromatic",
  "earthy",
  "fresh",
  "creamy",
  "rich",
  "nutty",
  "fruity",
  "floral",
  "fermented",
]);
export type FlavourTag = z.infer<typeof FlavourTagSchema>;

export const IngredientSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  categoryId: IdSchema.nullable(),
  measureKind: MeasureKindSchema,
  nutrition: NutritionSchema,
  notes: z.string().nullable(),
  archivedAt: IsoDateTimeSchema.nullable(),
  source: IngredientSourceSchema,
  imageId: IdSchema.nullable(),
  common: z.boolean(),
  /** V3 — ADR-008. Cited portion weight; null when unpublished. */
  gramsPerTsp: z.number().finite().positive().nullable(),
  gramsPerTbsp: z.number().finite().positive().nullable(),
  /** V3 — ADR-009. May be empty; never null. */
  flavourTags: z.array(FlavourTagSchema),
});
export type Ingredient = z.infer<typeof IngredientSchema>;

/** Lucide icon name + CSS token name for category chips (ADR-002 §3). */
export const IngredientCategorySchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  sortOrder: z.number().finite().int(),
  icon: z.string().min(1),
  accent: z.string().min(1),
});
export type IngredientCategory = z.infer<typeof IngredientCategorySchema>;

export const DEFAULT_CATEGORY_ICON = "Circle";
export const DEFAULT_CATEGORY_ACCENT = "--color-muted";

/**
 * True when figures came from a cited dataset but the user has since edited
 * nutrition (kind flipped to userEntered while origin fields remain).
 */
export function hasDivergedFromReference(ingredient: Ingredient): boolean {
  const { source } = ingredient;
  return (
    source.kind === "userEntered" &&
    (source.datasetId != null || source.entryCode != null)
  );
}

export function originFieldsEqual(
  a: IngredientSource,
  b: IngredientSource,
): boolean {
  return ORIGIN_FIELD_KEYS.every((key) => a[key] === b[key]);
}

export function nutritionEqual(
  a: Ingredient["nutrition"],
  b: Ingredient["nutrition"],
): boolean {
  return (
    a.kcal === b.kcal &&
    a.proteinG === b.proteinG &&
    a.carbsG === b.carbsG &&
    a.fatG === b.fatG &&
    a.sodiumMg === b.sodiumMg
  );
}

/**
 * Fill V1/V2-shaped ingredient rows for migration / backup import.
 * Does not invent nutrition figures or fabricate provenance.
 */
export function normalizeIngredientRow(row: unknown): unknown {
  if (!row || typeof row !== "object") return row;
  const record = row as Record<string, unknown>;
  const next: Record<string, unknown> = { ...record };
  if (!("source" in next) || next.source == null) {
    next.source = defaultUserEnteredSource();
  }
  if (!("imageId" in next)) next.imageId = null;
  if (!("common" in next) || typeof next.common !== "boolean") {
    next.common = true;
  }
  if (next.nutrition != null) {
    next.nutrition = normalizeNutrition(next.nutrition);
  }
  if (!("gramsPerTsp" in next)) next.gramsPerTsp = null;
  if (!("gramsPerTbsp" in next)) next.gramsPerTbsp = null;
  if (!Array.isArray(next.flavourTags)) next.flavourTags = [];
  return next;
}

export function normalizeCategoryRow(row: unknown): unknown {
  if (!row || typeof row !== "object") return row;
  const record = row as Record<string, unknown>;
  const next: Record<string, unknown> = { ...record };
  if (!("icon" in next) || typeof next.icon !== "string" || !next.icon) {
    next.icon = DEFAULT_CATEGORY_ICON;
  }
  if (
    !("accent" in next) ||
    typeof next.accent !== "string" ||
    !next.accent
  ) {
    next.accent = DEFAULT_CATEGORY_ACCENT;
  }
  return next;
}
