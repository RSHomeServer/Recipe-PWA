#!/usr/bin/env node
/**
 * Validate flavour-pack.json (R1.2–R1.4, R1.7) and allow-list integrity.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const packPath = path.join(root, "public/starter-pack/flavour-pack.json");
const allowPath = path.join(root, "src/data/flavour-pack/allow-list.json");
const equivPath = path.join(root, "src/data/flavour-pack/cofid-equivalence.json");
const brandedPath = path.join(root, "src/data/flavour-pack/branded-cache.json");

const FlavourTagSchema = z.enum([
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

const NutritionSchema = z.object({
  kcal: z.number().finite().nonnegative(),
  proteinG: z.number().finite().nonnegative(),
  carbsG: z.number().finite().nonnegative(),
  fatG: z.number().finite().nonnegative(),
  sodiumMg: z.number().finite().nonnegative().nullable(),
});

const IngredientSourceSchema = z.object({
  kind: z.enum(["reference", "packaging", "userEntered", "estimated"]),
  datasetId: z.string().min(1).nullable(),
  datasetName: z.string().min(1).nullable(),
  entryCode: z.string().min(1).nullable(),
  entryName: z.string().min(1).nullable(),
  licence: z.string().min(1).nullable(),
  url: z.string().min(1).nullable(),
  retrievedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  note: z.string().nullable(),
});

const IngredientSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  categoryId: z.string().uuid().nullable(),
  measureKind: z.enum(["mass", "volume", "count"]),
  nutrition: NutritionSchema,
  notes: z.string().nullable(),
  archivedAt: z.string().nullable(),
  source: IngredientSourceSchema,
  imageId: z.string().uuid().nullable(),
  common: z.boolean(),
  gramsPerTsp: z.number().finite().positive().nullable(),
  gramsPerTbsp: z.number().finite().positive().nullable(),
  flavourTags: z.array(FlavourTagSchema),
});

async function main() {
  const pack = JSON.parse(await readFile(packPath, "utf8"));
  const allow = JSON.parse(await readFile(allowPath, "utf8"));
  const equiv = JSON.parse(await readFile(equivPath, "utf8"));
  const branded = JSON.parse(await readFile(brandedPath, "utf8"));

  if (pack.dataset?.datasetId !== "usda-sr-legacy") {
    throw new Error(`Expected datasetId usda-sr-legacy; got ${pack.dataset?.datasetId}`);
  }

  if (!Array.isArray(pack.ingredients) || pack.ingredients.length === 0) {
    throw new Error("flavour-pack.json has no ingredients");
  }

  const allowIds = new Set(allow.entries.map((e) => String(e.fdcId)));
  const overlapIds = new Set((equiv.overlaps ?? []).map((e) => String(e.fdcId)));

  for (const id of allowIds) {
    if (overlapIds.has(id)) {
      throw new Error(`Allow-list contains CoFID-overlap FDC id ${id} (R1.3)`);
    }
  }

  for (const entry of allow.entries) {
    if (entry.source === "branded" && !branded.foods?.[String(entry.fdcId)]) {
      throw new Error(`Branded allow-list id ${entry.fdcId} missing from branded-cache`);
    }
  }

  const byCode = new Map();
  let errors = 0;
  for (const row of pack.ingredients) {
    const parsed = IngredientSchema.safeParse(row);
    if (!parsed.success) {
      errors += 1;
      if (errors <= 5) {
        console.error(row?.source?.entryCode, parsed.error.message);
      }
      continue;
    }
    if (!parsed.data.common) {
      throw new Error(`Flavour entry must be common: true (R1.4): ${parsed.data.source.entryCode}`);
    }
    if (parsed.data.measureKind === "count") {
      throw new Error(`Flavour pack must not contain count ingredients: ${parsed.data.source.entryCode}`);
    }
    const code = parsed.data.source.entryCode;
    if (!code || !allowIds.has(code)) {
      throw new Error(`Pack entryCode ${code} not on allow-list`);
    }
    if (byCode.has(code)) {
      throw new Error(`Duplicate entryCode in flavour pack: ${code}`);
    }
    byCode.set(code, parsed.data);

    // Full-pack spot check against published figures (ADR-006 verification 4).
    if (parsed.data.source.datasetId === "usda-branded") {
      const cached = branded.foods[code].nutritionPer100g;
      const n = parsed.data.nutrition;
      if (
        n.kcal !== Math.round(cached.kcal) ||
        Math.abs(n.proteinG - Math.round(cached.proteinG * 100) / 100) > 0.001 ||
        Math.abs(n.carbsG - Math.round(cached.carbsG * 100) / 100) > 0.001 ||
        Math.abs(n.fatG - Math.round(cached.fatG * 100) / 100) > 0.001 ||
        n.sodiumMg !== Math.round(cached.sodiumMg)
      ) {
        throw new Error(`Branded spot-check failed for FDC ${code}`);
      }
    }
  }

  if (errors > 0) {
    throw new Error(`IngredientSchema failed for ${errors} flavour-pack row(s)`);
  }

  for (const entry of allow.entries) {
    if (!byCode.has(String(entry.fdcId))) {
      throw new Error(`Allow-listed FDC ${entry.fdcId} missing from flavour-pack (R1.2)`);
    }
  }

  console.log(
    `OK: flavour-pack ${pack.ingredients.length} ingredients, all common, schema + allow-list + overlap checks passed`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
