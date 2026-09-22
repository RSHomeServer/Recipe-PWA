import { z } from "zod";
import {
  CanonicalQuantitySchema,
  UnitSchema,
} from "../units/schemas";
import { IdSchema, IsoDateTimeSchema } from "../shared/primitives";

export const RecipeLineSchema = z.object({
  id: IdSchema,
  ingredientId: IdSchema,
  quantity: CanonicalQuantitySchema,
  displayUnit: UnitSchema,
  optional: z.boolean(),
  note: z.string().nullable(),
});
export type RecipeLine = z.infer<typeof RecipeLineSchema>;

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
