import { z } from "zod";

export const MeasureKindSchema = z.enum(["mass", "volume", "count"]);
export type MeasureKind = z.infer<typeof MeasureKindSchema>;

export const UnitSchema = z.enum(["g", "kg", "ml", "L", "item"]);
export type Unit = z.infer<typeof UnitSchema>;

/** User-entered quantity. Input boundaries and display only. */
export const QuantitySchema = z.object({
  value: z.number().finite().nonnegative(),
  unit: UnitSchema,
});
export type Quantity = z.infer<typeof QuantitySchema>;

/**
 * Normalised quantity in the ingredient's canonical unit (g / ml / item).
 * May be negative for pantry stock (decision 12) — never clamped in the domain layer.
 */
export const CanonicalQuantitySchema = z.object({
  amount: z.number().finite(),
  kind: MeasureKindSchema,
});
export type CanonicalQuantity = z.infer<typeof CanonicalQuantitySchema>;

/** Minimal ingredient shape needed for family checks. */
export const MeasureKindBearerSchema = z.object({
  measureKind: MeasureKindSchema,
});
export type MeasureKindBearer = z.infer<typeof MeasureKindBearerSchema>;
