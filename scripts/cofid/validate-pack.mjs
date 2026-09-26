#!/usr/bin/env node
/**
 * Validate starter-pack/pack.json through IngredientSchema (R2.9).
 * Also re-checks common-code resolution (R2.5b / test 3a).
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const packPath = path.join(root, "public/starter-pack/pack.json");
const commonPath = path.join(root, "src/data/starter-pack/common-codes.json");

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
  const common = JSON.parse(await readFile(commonPath, "utf8"));

  if (!Array.isArray(pack.ingredients) || pack.ingredients.length === 0) {
    throw new Error("pack.json has no ingredients");
  }

  const codes = new Set();
  let errors = 0;
  let sodiumNull = 0;
  let sodiumZero = 0;
  for (const row of pack.ingredients) {
    const parsed = IngredientSchema.safeParse(row);
    if (!parsed.success) {
      errors += 1;
      if (errors <= 5) {
        console.error(row?.source?.entryCode, parsed.error.message);
      }
      continue;
    }
    if (parsed.data.measureKind === "count") {
      throw new Error(
        `Pack must not contain count ingredients (R2.5e): ${parsed.data.source.entryCode}`,
      );
    }
    if (parsed.data.nutrition.sodiumMg === null) sodiumNull += 1;
    else if (parsed.data.nutrition.sodiumMg === 0) sodiumZero += 1;
    const code = parsed.data.source.entryCode;
    if (code) codes.add(code);
  }

  if (errors > 0) {
    throw new Error(`IngredientSchema failed for ${errors} pack row(s)`);
  }

  /** @type {string[]} */
  const unresolved = [];
  for (const code of common.codes ?? []) {
    if (!codes.has(code)) unresolved.push(code);
  }
  if (unresolved.length > 0) {
    throw new Error(
      `Common codes unresolved (${unresolved.length}): ${unresolved.slice(0, 10).join(", ")}`,
    );
  }

  const volume = pack.ingredients.filter((i) => i.measureKind === "volume");
  if (volume.length === 0) {
    throw new Error("Expected at least one volume (alcohol) entry");
  }

  console.log(
    `OK: ${pack.ingredients.length} ingredients, ${common.codes.length} common, ${volume.length} volume, sodium null=${sodiumNull} zero=${sodiumZero}`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
