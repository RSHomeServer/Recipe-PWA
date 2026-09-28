#!/usr/bin/env node
/**
 * Bake flavour-tags.json into starter + flavour pack JSON (R4.2).
 * Safe to re-run; does not invent nutrition figures.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyFlavourTags,
  assertFlavourTagsMatch,
  loadFlavourTagMap,
} from "./apply.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const starterPackPath = path.join(root, "public/starter-pack/pack.json");
const flavourPackPath = path.join(root, "public/starter-pack/flavour-pack.json");

async function patchPack(packPath, tagsByKey, datasetIds, requireFullCoverage) {
  const pack = JSON.parse(await readFile(packPath, "utf8"));
  applyFlavourTags(pack.ingredients, tagsByKey, {
    datasetIds,
    requireFullCoverage,
  });
  assertFlavourTagsMatch(pack.ingredients, tagsByKey, {
    datasetIds,
    requireFullCoverage,
  });
  await writeFile(packPath, `${JSON.stringify(pack)}\n`, "utf8");
  const tagged = pack.ingredients.filter((i) => (i.flavourTags?.length ?? 0) > 0)
    .length;
  return { path: packPath, total: pack.ingredients.length, tagged };
}

async function main() {
  const { tags } = await loadFlavourTagMap();
  const starter = await patchPack(starterPackPath, tags, ["cofid-2021"], false);
  const flavour = await patchPack(
    flavourPackPath,
    tags,
    ["usda-sr-legacy", "usda-branded"],
    true,
  );

  // Joint resolution: every map key must exist in the union of both packs.
  const starterPack = JSON.parse(await readFile(starterPackPath, "utf8"));
  const flavourPack = JSON.parse(await readFile(flavourPackPath, "utf8"));
  assertFlavourTagsMatch(
    [...starterPack.ingredients, ...flavourPack.ingredients],
    tags,
  );

  const paprika = flavourPack.ingredients.find(
    (i) => i.source?.entryCode === "171329",
  );
  if (!paprika?.flavourTags?.includes("smoky")) {
    throw new Error("Paprika (171329) must be tagged smoky (ticket 4)");
  }

  console.log(
    `OK: flavour tags applied — starter ${starter.tagged}/${starter.total}, flavour ${flavour.tagged}/${flavour.total}, map keys ${Object.keys(tags).length}`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
