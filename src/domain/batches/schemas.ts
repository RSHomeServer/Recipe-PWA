import { z } from "zod";
import { BatchSnapshotSchema } from "../nutrition/schemas";
import { IdSchema, IsoDateTimeSchema } from "../shared/primitives";

export const BatchSchema = z.object({
  id: IdSchema,
  recipeId: IdSchema,
  scale: z.number().finite().positive(),
  portionsNominal: z.number().finite().positive(),
  cookedAt: IsoDateTimeSchema,
  label: z.string().nullable(),
  closedAt: IsoDateTimeSchema.nullable(),
  notes: z.string().nullable(),
  snapshot: BatchSnapshotSchema,
});
export type Batch = z.infer<typeof BatchSchema>;

/** Fields allowed on update — snapshot is intentionally omitted. */
export const BatchUpdateSchema = BatchSchema.omit({
  id: true,
  snapshot: true,
}).partial();
export type BatchUpdate = z.infer<typeof BatchUpdateSchema>;
