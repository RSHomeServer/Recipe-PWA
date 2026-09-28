/**
 * Shared flavour-tag map application (ADR-009 / R4.2).
 * Keys are `datasetId::entryCode`. Unresolved keys fail the build.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

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

const TagMapSchema = z.object({
  version: z.number().int().positive(),
  notes: z.string().optional(),
  tags: z.record(z.string().min(1), z.array(FlavourTagSchema)),
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const FLAVOUR_TAGS_PATH = path.resolve(
  __dirname,
  "../../src/data/flavour-tags/flavour-tags.json",
);

/**
 * @param {string} [mapPath]
 * @returns {Promise<{ version: number, tags: Record<string, string[]> }>}
 */
export async function loadFlavourTagMap(mapPath = FLAVOUR_TAGS_PATH) {
  const raw = JSON.parse(await readFile(mapPath, "utf8"));
  const parsed = TagMapSchema.parse(raw);
  /** @type {Record<string, string[]>} */
  const tags = {};
  for (const [key, values] of Object.entries(parsed.tags)) {
    tags[key] = [...new Set(values)].sort();
  }
  return { version: parsed.version, tags };
}

/**
 * @param {{ source?: { datasetId?: string | null, entryCode?: string | null } }} ingredient
 * @returns {string | null}
 */
export function ingredientTagKey(ingredient) {
  const datasetId = ingredient.source?.datasetId;
  const entryCode = ingredient.source?.entryCode;
  if (!datasetId || !entryCode) return null;
  return `${datasetId}::${entryCode}`;
}

/**
 * Apply map tags onto ingredients.
 *
 * - Map keys for `datasetIds` must resolve (R4.2 / R2.5b).
 * - When `requireFullCoverage`, every ingredient in those datasets must have a map entry
 *   (flavour pack). CoFID uses requireFullCoverage=false so the long tail stays [].
 *
 * @template {{ source: { datasetId: string | null, entryCode: string | null }, flavourTags: string[] }} T
 * @param {T[]} ingredients
 * @param {Record<string, string[]>} tagsByKey
 * @param {{ datasetIds?: string[], requireFullCoverage?: boolean }} [options]
 * @returns {T[]}
 */
export function applyFlavourTags(ingredients, tagsByKey, options = {}) {
  const datasetFilter = options.datasetIds
    ? new Set(options.datasetIds)
    : null;
  const requireFullCoverage = options.requireFullCoverage ?? false;

  const byKey = new Map();
  for (const ingredient of ingredients) {
    const key = ingredientTagKey(ingredient);
    if (key) byKey.set(key, ingredient);
  }

  /** @type {string[]} */
  const unresolved = [];
  for (const [key, tags] of Object.entries(tagsByKey)) {
    const datasetId = key.split("::")[0];
    if (datasetFilter && !datasetFilter.has(datasetId)) continue;
    const hit = byKey.get(key);
    if (!hit) {
      unresolved.push(key);
      continue;
    }
    hit.flavourTags = [...tags];
  }

  if (unresolved.length > 0) {
    const preview = unresolved.slice(0, 20).join(", ");
    throw new Error(
      `Flavour-tag map has ${unresolved.length} key(s) with no seeded entry: ${preview}`,
    );
  }

  if (requireFullCoverage) {
    /** @type {string[]} */
    const missing = [];
    for (const ingredient of ingredients) {
      const key = ingredientTagKey(ingredient);
      if (!key) continue;
      const datasetId = ingredient.source.datasetId;
      if (datasetFilter && datasetId && !datasetFilter.has(datasetId)) continue;
      if (!(key in tagsByKey)) missing.push(key);
    }
    if (missing.length > 0) {
      throw new Error(
        `Pack ingredient(s) missing flavour-tags.json entry: ${missing.slice(0, 10).join(", ")}`,
      );
    }
  }

  // Untagged ingredients (outside map) keep [] — leave as-is if already [].
  for (const ingredient of ingredients) {
    const key = ingredientTagKey(ingredient);
    if (!key) {
      ingredient.flavourTags = [];
      continue;
    }
    const datasetId = ingredient.source.datasetId;
    if (datasetFilter && datasetId && !datasetFilter.has(datasetId)) continue;
    if (!(key in tagsByKey)) {
      ingredient.flavourTags = [];
    }
  }

  return ingredients;
}

/**
 * Assert every in-scope map key resolves and tagged ingredients match the map.
 *
 * @param {Array<{ source: { datasetId: string | null, entryCode: string | null }, flavourTags: string[] }>} ingredients
 * @param {Record<string, string[]>} tagsByKey
 * @param {{ datasetIds?: string[], requireFullCoverage?: boolean }} [options]
 */
export function assertFlavourTagsMatch(ingredients, tagsByKey, options = {}) {
  applyFlavourTags(
    ingredients.map((i) => ({
      ...i,
      flavourTags: [...(i.flavourTags ?? [])],
    })),
    tagsByKey,
    options,
  );

  const datasetFilter = options.datasetIds
    ? new Set(options.datasetIds)
    : null;

  const byKey = new Map();
  for (const ingredient of ingredients) {
    const key = ingredientTagKey(ingredient);
    if (key) byKey.set(key, ingredient);
  }

  /** @type {string[]} */
  const mismatched = [];
  for (const [key, expected] of Object.entries(tagsByKey)) {
    const datasetId = key.split("::")[0];
    if (datasetFilter && !datasetFilter.has(datasetId)) continue;
    const hit = byKey.get(key);
    if (!hit) continue;
    const actual = [...(hit.flavourTags ?? [])].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      mismatched.push(
        `${key}: expected [${expected.join(", ")}] got [${actual.join(", ")}]`,
      );
    }
  }
  if (mismatched.length > 0) {
    throw new Error(
      `Flavour-tag map mismatch (${mismatched.length}): ${mismatched.slice(0, 5).join("; ")}`,
    );
  }
}
