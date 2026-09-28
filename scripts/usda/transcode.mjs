#!/usr/bin/env node
/**
 * Build-time USDA → flavour pack transcode (ADR-006 / R1.1–R1.4, R1.7).
 *
 * Reads:
 *   - Hand-maintained allow-list of FDC ids
 *   - USDA SR Legacy CSVs (download once into data/usda/)
 *   - branded-cache.json for the three Branded exceptions (MSG, nutritional yeast,
 *     smoked paprika) when SR Legacy has no generic row
 *
 * Emits public/starter-pack/flavour-pack.json. Never hand-types nutrition figures.
 *
 * Usage:
 *   node scripts/usda/transcode.mjs [--csv-dir path] [--out path]
 */

import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { deterministicId } from "./deterministic-id.mjs";
import { categoryIdForUsdaCategory } from "./categories.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

export const FLAVOUR_PACK_VERSION = "usda-sr-legacy-v1";

const SR_DATASET = {
  datasetId: "usda-sr-legacy",
  datasetName:
    "USDA FoodData Central — SR Legacy (April 2018)",
  licence: "CC0-1.0",
  url: "https://fdc.nal.usda.gov/download-datasets.html",
  retrievedAt: "2018-04-01",
};

const BRANDED_DATASET = {
  datasetId: "usda-branded",
  datasetName: "USDA FoodData Central — Branded Foods",
  licence: "CC0-1.0",
  url: "https://fdc.nal.usda.gov/download-datasets.html",
  retrievedAt: "2026-09-26",
};

const NUTRIENT_IDS = {
  kcal: 1008,
  proteinG: 1003,
  fatG: 1004,
  carbsG: 1005,
  sodiumMg: 1093,
};

const DEFAULT_CSV_DIR = path.join(
  root,
  "data/usda/FoodData_Central_sr_legacy_food_csv_2018-04",
);
const ALLOW_LIST_PATH = path.join(
  root,
  "src/data/flavour-pack/allow-list.json",
);
const EQUIV_PATH = path.join(
  root,
  "src/data/flavour-pack/cofid-equivalence.json",
);
const BRANDED_CACHE_PATH = path.join(
  root,
  "src/data/flavour-pack/branded-cache.json",
);
const COFID_PACK_PATH = path.join(root, "public/starter-pack/pack.json");

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {{ csvDir: string; out: string }} */
  const opts = {
    csvDir: DEFAULT_CSV_DIR,
    out: path.join(root, "public/starter-pack/flavour-pack.json"),
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--csv-dir") opts.csvDir = path.resolve(argv[++i] ?? "");
    else if (arg === "--out") opts.out = path.resolve(argv[++i] ?? "");
  }
  return opts;
}

/**
 * Minimal CSV parser for FDC quoted CSVs (no embedded newlines in practice).
 * @param {string} line
 * @returns {string[]}
 */
function parseCsvLine(line) {
  /** @type {string[]} */
  const fields = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

/**
 * @param {string} filePath
 * @param {(row: Record<string, string>) => void} onRow
 */
async function forEachCsvRow(filePath, onRow) {
  const stream = createReadStream(filePath, { encoding: "utf8" });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  /** @type {string[] | null} */
  let headers = null;
  for await (const line of rl) {
    if (!line.trim()) continue;
    const fields = parseCsvLine(line);
    if (!headers) {
      headers = fields;
      continue;
    }
    /** @type {Record<string, string>} */
    const row = {};
    for (let i = 0; i < headers.length; i += 1) {
      row[headers[i]] = fields[i] ?? "";
    }
    onRow(row);
  }
}

/**
 * @param {string} csvDir
 * @param {Set<number>} fdcIds
 */
async function loadSrFoods(csvDir, fdcIds) {
  const foodPath = path.join(csvDir, "food.csv");
  const nutrientPath = path.join(csvDir, "food_nutrient.csv");
  await access(foodPath);
  await access(nutrientPath);

  /** @type {Map<number, { description: string; foodCategoryId: string }>} */
  const foods = new Map();
  await forEachCsvRow(foodPath, (row) => {
    const id = Number(row.fdc_id);
    if (!fdcIds.has(id)) return;
    foods.set(id, {
      description: row.description,
      foodCategoryId: row.food_category_id,
    });
  });

  /** @type {Map<number, Record<string, number | null>>} */
  const nutrients = new Map();
  const wanted = new Set(Object.values(NUTRIENT_IDS));
  await forEachCsvRow(nutrientPath, (row) => {
    const id = Number(row.fdc_id);
    if (!fdcIds.has(id)) return;
    const nutrientId = Number(row.nutrient_id);
    if (!wanted.has(nutrientId)) return;
    if (!nutrients.has(id)) {
      nutrients.set(id, {
        kcal: null,
        proteinG: null,
        fatG: null,
        carbsG: null,
        sodiumMg: null,
      });
    }
    const bag = nutrients.get(id);
    const amount =
      row.amount === "" || row.amount == null ? null : Number(row.amount);
    if (nutrientId === NUTRIENT_IDS.kcal) bag.kcal = amount;
    else if (nutrientId === NUTRIENT_IDS.proteinG) bag.proteinG = amount;
    else if (nutrientId === NUTRIENT_IDS.fatG) bag.fatG = amount;
    else if (nutrientId === NUTRIENT_IDS.carbsG) bag.carbsG = amount;
    else if (nutrientId === NUTRIENT_IDS.sodiumMg) bag.sodiumMg = amount;
  });

  return { foods, nutrients };
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function requireFiniteNonNeg(value, label, fdcId) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(
      `FDC ${fdcId}: missing or invalid ${label} (got ${String(value)})`,
    );
  }
  return value;
}

/**
 * Round like CoFID macros (1 decimal for macros, whole kcal / sodium).
 * @param {number} n
 * @param {number} digits
 */
function round(n, digits) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  const allowList = JSON.parse(await readFile(ALLOW_LIST_PATH, "utf8"));
  const equivalence = JSON.parse(await readFile(EQUIV_PATH, "utf8"));
  const brandedCache = JSON.parse(await readFile(BRANDED_CACHE_PATH, "utf8"));
  const cofidPack = JSON.parse(await readFile(COFID_PACK_PATH, "utf8"));

  if (!Array.isArray(allowList.entries) || allowList.entries.length === 0) {
    throw new Error("allow-list.json has no entries");
  }
  if (
    allowList.entries.length < 60 ||
    allowList.entries.length > 120
  ) {
    throw new Error(
      `allow-list expected 60–120 entries (R1.2); got ${allowList.entries.length}`,
    );
  }

  /** @type {Map<number, string>} */
  const overlapByFdc = new Map();
  for (const row of equivalence.overlaps ?? []) {
    overlapByFdc.set(Number(row.fdcId), String(row.cofidCode));
  }

  /** @type {Set<string>} */
  const cofidCodes = new Set(
    (cofidPack.ingredients ?? []).map((i) => i?.source?.entryCode).filter(Boolean),
  );

  /** @type {string[]} */
  const overlapErrors = [];
  for (const entry of allowList.entries) {
    const fdcId = Number(entry.fdcId);
    const cofidCode = overlapByFdc.get(fdcId);
    if (cofidCode) {
      overlapErrors.push(
        `FDC ${fdcId} (${entry.ukName}) overlaps CoFID ${cofidCode} — remove from allow-list (R1.3)`,
      );
      continue;
    }
    // Defensive: if equivalence lists a code that is not in the pack, still fail
    // only when the allow-list hits a mapped id (already handled). Also fail if
    // an equivalence cofidCode is missing from pack (stale map).
  }

  for (const row of equivalence.overlaps ?? []) {
    if (!cofidCodes.has(String(row.cofidCode))) {
      overlapErrors.push(
        `Equivalence map references missing CoFID code ${row.cofidCode} (FDC ${row.fdcId})`,
      );
    }
  }

  if (overlapErrors.length > 0) {
    throw new Error(overlapErrors.join("\n"));
  }

  const srIds = new Set(
    allowList.entries
      .filter((e) => e.source === "sr-legacy")
      .map((e) => Number(e.fdcId)),
  );
  const brandedIds = allowList.entries
    .filter((e) => e.source === "branded")
    .map((e) => Number(e.fdcId));

  for (const id of brandedIds) {
    if (!brandedCache.foods?.[String(id)]) {
      throw new Error(
        `Branded FDC ${id} missing from branded-cache.json — run fetch-branded-cache`,
      );
    }
  }

  const { foods, nutrients } = await loadSrFoods(opts.csvDir, srIds);

  /** @type {object[]} */
  const ingredients = [];
  /** @type {string[]} */
  const missing = [];

  for (const entry of allowList.entries) {
    const fdcId = Number(entry.fdcId);
    const entryCode = String(fdcId);
    const ukName = String(entry.ukName).trim();
    if (!ukName) {
      throw new Error(`Allow-list entry ${fdcId} missing ukName`);
    }

    if (entry.source === "branded") {
      const cached = brandedCache.foods[entryCode];
      const n = cached.nutritionPer100g;
      const dataset = BRANDED_DATASET;
      ingredients.push({
        id: deterministicId(`branded:${entryCode}`),
        name: ukName,
        categoryId: categoryIdForUsdaCategory(2),
        measureKind: "mass",
        nutrition: {
          kcal: round(requireFiniteNonNeg(n.kcal, "kcal", fdcId), 0),
          proteinG: round(requireFiniteNonNeg(n.proteinG, "proteinG", fdcId), 2),
          carbsG: round(requireFiniteNonNeg(n.carbsG, "carbsG", fdcId), 2),
          fatG: round(requireFiniteNonNeg(n.fatG, "fatG", fdcId), 2),
          sodiumMg: round(requireFiniteNonNeg(n.sodiumMg, "sodiumMg", fdcId), 0),
        },
        notes: null,
        archivedAt: null,
        source: {
          kind: "reference",
          datasetId: dataset.datasetId,
          datasetName: dataset.datasetName,
          entryCode,
          entryName: cached.description,
          licence: dataset.licence,
          url: cached.url ?? dataset.url,
          retrievedAt: dataset.retrievedAt,
          note: cached.brandOwner
            ? `Branded exception (ADR-006 gap): ${cached.brandOwner}`
            : "Branded exception (ADR-006 gap)",
        },
        imageId: null,
        common: true,
        gramsPerTsp: null,
        gramsPerTbsp: null,
        flavourTags: [],
      });
      continue;
    }

    const food = foods.get(fdcId);
    if (!food) {
      missing.push(entryCode);
      continue;
    }
    const n = nutrients.get(fdcId);
    if (!n) {
      throw new Error(`FDC ${fdcId} (${ukName}) has no nutrient rows`);
    }
    // Macros must be present; sodium may be null (unknown).
    const kcal = requireFiniteNonNeg(n.kcal, "kcal", fdcId);
    const proteinG = requireFiniteNonNeg(n.proteinG, "proteinG", fdcId);
    const carbsG = requireFiniteNonNeg(n.carbsG, "carbsG", fdcId);
    const fatG = requireFiniteNonNeg(n.fatG, "fatG", fdcId);
    const sodiumMg =
      n.sodiumMg == null || !Number.isFinite(n.sodiumMg)
        ? null
        : round(n.sodiumMg, 0);

    ingredients.push({
      id: deterministicId(`sr-legacy:${entryCode}`),
      name: ukName,
      categoryId: categoryIdForUsdaCategory(food.foodCategoryId),
      measureKind: "mass",
      nutrition: {
        kcal: round(kcal, 0),
        proteinG: round(proteinG, 2),
        carbsG: round(carbsG, 2),
        fatG: round(fatG, 2),
        sodiumMg,
      },
      notes: null,
      archivedAt: null,
      source: {
        kind: "reference",
        datasetId: SR_DATASET.datasetId,
        datasetName: SR_DATASET.datasetName,
        entryCode,
        entryName: food.description,
        licence: SR_DATASET.licence,
        url: `https://fdc.nal.usda.gov/food-details/${fdcId}/nutrients`,
        retrievedAt: SR_DATASET.retrievedAt,
        note: null,
      },
      imageId: null,
      common: true,
      gramsPerTsp: null,
      gramsPerTbsp: null,
      flavourTags: [],
    });
  }

  if (missing.length > 0) {
    throw new Error(
      `Allow-listed FDC id(s) not found in SR Legacy CSV (${missing.length}): ${missing.slice(0, 20).join(", ")}`,
    );
  }

  const pack = {
    version: FLAVOUR_PACK_VERSION,
    dataset: SR_DATASET,
    generatedAt: new Date().toISOString(),
    stats: {
      allowListed: allowList.entries.length,
      seeded: ingredients.length,
      srLegacy: ingredients.filter(
        (i) => i.source.datasetId === SR_DATASET.datasetId,
      ).length,
      brandedExceptions: ingredients.filter(
        (i) => i.source.datasetId === BRANDED_DATASET.datasetId,
      ).length,
      commonCount: ingredients.filter((i) => i.common).length,
    },
    ingredients,
  };

  await mkdir(path.dirname(opts.out), { recursive: true });
  await writeFile(opts.out, `${JSON.stringify(pack)}\n`, "utf8");

  const metaPath = path.join(root, "src/data/flavour-pack/meta.json");
  await writeFile(
    metaPath,
    `${JSON.stringify(
      {
        version: FLAVOUR_PACK_VERSION,
        dataset: SR_DATASET,
        brandedDataset: BRANDED_DATASET,
        stats: pack.stats,
        attributionNote:
          "SR Legacy and Branded Foods data from USDA FoodData Central are dedicated to the public domain under CC0 1.0. Attribution is given voluntarily.",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(
    `Wrote ${ingredients.length} flavour ingredients → ${opts.out}`,
  );
  console.log(JSON.stringify(pack.stats, null, 2));
}

const isDirect =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirect) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
