#!/usr/bin/env node
/**
 * Refresh branded-cache.json from the FDC API for allow-listed branded exceptions.
 * Requires network. DEMO_KEY is fine for occasional refreshes.
 *
 *   node scripts/usda/fetch-branded-cache.mjs [--api-key KEY]
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const allowPath = path.join(root, "src/data/flavour-pack/allow-list.json");
const outPath = path.join(root, "src/data/flavour-pack/branded-cache.json");

function parseArgs(argv) {
  let apiKey = process.env.FDC_API_KEY || "DEMO_KEY";
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--api-key") apiKey = argv[++i] ?? apiKey;
  }
  return { apiKey };
}

function extractNutrition(food) {
  /** @type {Record<string, number>} */
  const nuts = {};
  for (const n of food.foodNutrients ?? []) {
    const nut = n.nutrient ?? {};
    const name = nut.name;
    const unit = String(nut.unitName ?? "").toUpperCase();
    const amount = Number(n.amount);
    if (!Number.isFinite(amount)) continue;
    if (name === "Energy" && unit === "KCAL") nuts.kcal = amount;
    else if (name === "Protein") nuts.proteinG = amount;
    else if (name === "Total lipid (fat)") nuts.fatG = amount;
    else if (name === "Carbohydrate, by difference") nuts.carbsG = amount;
    else if (name === "Sodium, Na") nuts.sodiumMg = amount;
  }
  for (const key of ["kcal", "proteinG", "fatG", "carbsG", "sodiumMg"]) {
    if (typeof nuts[key] !== "number") {
      throw new Error(`FDC ${food.fdcId} missing ${key}`);
    }
  }
  return nuts;
}

async function fetchFood(fdcId, apiKey) {
  const url = `https://api.nal.usda.gov/fdc/v1/food/${fdcId}?api_key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`FDC ${fdcId}: HTTP ${response.status}`);
  }
  return response.json();
}

async function main() {
  const { apiKey } = parseArgs(process.argv.slice(2));
  const allow = JSON.parse(await readFile(allowPath, "utf8"));
  const brandedEntries = allow.entries.filter((e) => e.source === "branded");
  if (brandedEntries.length === 0) {
    throw new Error("No branded entries on allow-list");
  }

  /** @type {Record<string, object>} */
  const foods = {};
  for (const entry of brandedEntries) {
    const food = await fetchFood(entry.fdcId, apiKey);
    foods[String(entry.fdcId)] = {
      fdcId: food.fdcId,
      dataType: food.dataType,
      description: food.description,
      brandOwner: food.brandOwner ?? null,
      brandName: food.brandName ?? null,
      gtinUpc: food.gtinUpc ?? null,
      publicationDate: food.publicationDate ?? null,
      ingredients: food.ingredients ?? null,
      nutritionPer100g: extractNutrition(food),
      url: `https://fdc.nal.usda.gov/food-details/${food.fdcId}/nutrients`,
    };
    // Be kind to DEMO_KEY rate limits.
    await new Promise((r) => setTimeout(r, 1100));
  }

  const cache = {
    retrievedNote:
      "Slim snapshots of USDA FDC Branded food records for flavour-pack exceptions. Figures come from the FDC API foodNutrients amounts (per 100 g as published).",
    retrievedAt: new Date().toISOString(),
    foods,
  };
  await writeFile(outPath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
  console.log(`Wrote ${Object.keys(foods).length} branded foods → ${outPath}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
