import { z } from "zod";
import {
  CanonicalQuantitySchema,
  UnitSchema,
} from "../units/schemas";
import { IdSchema, IsoDateTimeSchema } from "../shared/primitives";

export const SpoonEntryHintSchema = z.object({
  spoons: z.number().finite().positive(),
  spoon: z.enum(["tsp", "tbsp"]),
});
export type SpoonEntryHint = z.infer<typeof SpoonEntryHintSchema>;

export const RecipeLineSchema = z.object({
  id: IdSchema,
  ingredientId: IdSchema,
  quantity: CanonicalQuantitySchema,
  displayUnit: UnitSchema,
  optional: z.boolean(),
  note: z.string().nullable(),
  /** V3 — ADR-008. Display-only read-back; derivations must not read it. */
  entryHint: SpoonEntryHintSchema.nullable(),
});
export type RecipeLine = z.infer<typeof RecipeLineSchema>;

export const RecipeKindSchema = z.enum(["dish", "mix"]);
export type RecipeKind = z.infer<typeof RecipeKindSchema>;

export const RecipeSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  servings: z.number().finite().positive(),
  lines: z.array(RecipeLineSchema),
  steps: z.array(z.string()),
  tags: z.array(z.string()),
  imageId: IdSchema.nullable(),
  notes: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  archivedAt: IsoDateTimeSchema.nullable(),
  /** V3 — ADR-010. Metadata only; default dish. */
  kind: RecipeKindSchema,
});
export type Recipe = z.infer<typeof RecipeSchema>;

/** Stored image blob — Blob at rest in IndexedDB; base64 only in backups. */
export const RecipeImageSchema = z.object({
  id: IdSchema,
  blob: z.instanceof(Blob),
  width: z.number().finite().positive().int(),
  height: z.number().finite().positive().int(),
});
export type RecipeImage = z.infer<typeof RecipeImageSchema>;

/** Backup / wire form of RecipeImage (no Blob). */
export const RecipeImageExportSchema = z.object({
  id: IdSchema,
  blobBase64: z.string().min(1),
  mimeType: z.string().min(1),
  width: z.number().finite().positive().int(),
  height: z.number().finite().positive().int(),
});
export type RecipeImageExport = z.infer<typeof RecipeImageExportSchema>;

/**
 * Fill pre-v3 recipe rows for migration / backup import.
 * Defaults: kind "dish"; each line entryHint null.
 */
export function normalizeRecipeRow(row: unknown): unknown {
  if (!row || typeof row !== "object") return row;
  const record = row as Record<string, unknown>;
  const next: Record<string, unknown> = { ...record };
  if (next.kind !== "dish" && next.kind !== "mix") {
    next.kind = "dish";
  }
  if (Array.isArray(next.lines)) {
    next.lines = next.lines.map((line) => {
      if (!line || typeof line !== "object") return line;
      const lineRecord = line as Record<string, unknown>;
      if (!("entryHint" in lineRecord)) {
        return { ...lineRecord, entryHint: null };
      }
      return lineRecord;
    });
  }
  return next;
}
