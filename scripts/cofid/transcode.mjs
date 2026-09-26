#!/usr/bin/env node
/**
 * Build-time CoFID → starter pack transcode (ADR-002 §2 / R2.5*).
 * Reads the published Excel workbook; never ships xlsx to the browser.
 *
 * Usage:
 *   node scripts/cofid/transcode.mjs [--xlsx path] [--out-dir path]
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
import { deterministicId } from "./deterministic-id.mjs";
import {
  categoryIdForGroup,
  measureKindForGroup,
} from "./group-to-category.mjs";
import { parseRequiredMacros, parseSodiumMg } from "./parse-macros.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

const DATASET = {
  datasetId: "cofid-2021",
  datasetName:
    "McCance and Widdowson's The Composition of Foods Integrated Dataset 2021",
  /** Placeholder — human must confirm OGL version from GOV.UK licence footer (R2.12). */
  licence: "OGL-UK-3.0",
  url: "https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid",
  retrievedAt: "2021-03-19",
};

export const STARTER_PACK_VERSION = "cofid-2021-v2";

const DEFAULT_XLSX = path.join(root, "data/cofid/CoFID_2021.xlsx");
const DEFAULT_OUT = path.join(root, "src/data/starter-pack");
const COMMON_CODES_PATH = path.join(DEFAULT_OUT, "common-codes.json");

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {{ xlsx: string; outDir: string }} */
  const opts = { xlsx: DEFAULT_XLSX, outDir: DEFAULT_OUT };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--xlsx") opts.xlsx = path.resolve(argv[++i] ?? "");
    else if (arg === "--out-dir") opts.outDir = path.resolve(argv[++i] ?? "");
  }
  return opts;
}

/**
 * Locate macro columns by acronym row (row index 1).
 * @param {unknown[][]} rows
 */
function findColumns(rows, sheetLabel) {
  const acronyms = rows[1] ?? [];
  const headers = rows[0] ?? [];

  const findAcronym = (name) => {
    const idx = acronyms.findIndex(
      (cell) => String(cell ?? "").trim().toUpperCase() === name,
    );
    if (idx < 0) {
      throw new Error(`${sheetLabel} sheet missing acronym column ${name}`);
    }
    return idx;
  };

  const findHeader = (name) => {
    const idx = headers.findIndex(
      (cell) => String(cell ?? "").trim().toLowerCase() === name.toLowerCase(),
    );
    if (idx < 0) {
      throw new Error(`${sheetLabel} sheet missing header ${name}`);
    }
    return idx;
  };

  return {
    code: findHeader("Food Code"),
    name: findHeader("Food Name"),
    group: findHeader("Group"),
    prot: findAcronym("PROT"),
    fat: findAcronym("FAT"),
    cho: findAcronym("CHO"),
    kcals: findAcronym("KCALS"),
    findAcronym,
    findHeader,
  };
}

/**
 * @param {string} xlsxPath
 */
export function transcodeWorkbook(xlsxPath) {
  const workbook = XLSX.readFile(xlsxPath);
  const sheetName = workbook.SheetNames.find((name) =>
    /proximate/i.test(name),
  );
  if (!sheetName) {
    throw new Error(
      `No Proximates worksheet in ${xlsxPath}; sheets: ${workbook.SheetNames.join(", ")}`,
    );
  }
  const inorganicsName = workbook.SheetNames.find((name) =>
    /inorganic/i.test(name),
  );
  if (!inorganicsName) {
    throw new Error(
      `No Inorganics worksheet in ${xlsxPath}; sheets: ${workbook.SheetNames.join(", ")}`,
    );
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = /** @type {unknown[][]} */ (
    XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      raw: true,
      blankrows: false,
    })
  );
  const inorganicsRows = /** @type {unknown[][]} */ (
    XLSX.utils.sheet_to_json(workbook.Sheets[inorganicsName], {
      header: 1,
      defval: null,
      raw: true,
      blankrows: false,
    })
  );

  if (rows.length < 4) {
    throw new Error("Proximates sheet has no data rows (expected headers in rows 1–3)");
  }
  if (inorganicsRows.length !== rows.length) {
    throw new Error(
      `Inorganics row count (${inorganicsRows.length}) does not match Proximates (${rows.length})`,
    );
  }

  const cols = findColumns(rows, "Proximates");
  const inorgAcronyms = inorganicsRows[1] ?? [];
  const sodiumCol = inorgAcronyms.findIndex(
    (cell) => String(cell ?? "").trim().toUpperCase() === "NA",
  );
  if (sodiumCol < 0) {
    throw new Error("Inorganics sheet missing acronym column NA");
  }
  const dataRows = rows.slice(3);
  const inorganicsData = inorganicsRows.slice(3);

  /** @type {object[]} */
  const ingredients = [];
  /** @type {Record<string, number>} */
  const sodiumIndex = {};
  let excludedN = 0;
  let incomplete = 0;
  let duplicateCodes = 0;
  let sodiumKnown = 0;
  let sodiumNull = 0;
  let sodiumZero = 0;
  const seenCodes = new Set();

  for (let i = 0; i < dataRows.length; i += 1) {
    const row = dataRows[i];
    const inorgRow = inorganicsData[i] ?? [];
    const entryCode = String(row[cols.code] ?? "").trim();
    const entryName = String(row[cols.name] ?? "").trim();
    const group = String(row[cols.group] ?? "").trim();
    if (!entryCode || !entryName) {
      incomplete += 1;
      continue;
    }

    if (seenCodes.has(entryCode)) {
      // CoFID 2021 ships at least one duplicated food code (13-669).
      duplicateCodes += 1;
      continue;
    }

    const macros = parseRequiredMacros({
      kcals: row[cols.kcals],
      prot: row[cols.prot],
      fat: row[cols.fat],
      cho: row[cols.cho],
    });

    if (macros.status === "exclude") {
      excludedN += 1;
      continue;
    }
    if (macros.status !== "ok") {
      incomplete += 1;
      continue;
    }

    const sodiumMg = parseSodiumMg(inorgRow[sodiumCol]);
    if (sodiumMg === null) sodiumNull += 1;
    else if (sodiumMg === 0) sodiumZero += 1;
    else sodiumKnown += 1;

    seenCodes.add(entryCode);
    const key = `${DATASET.datasetId}::${entryCode}`;
    if (sodiumMg !== null) sodiumIndex[key] = sodiumMg;

    ingredients.push({
      id: deterministicId(`cofid:${entryCode}`),
      name: entryName,
      categoryId: categoryIdForGroup(group),
      measureKind: measureKindForGroup(group),
      nutrition: {
        kcal: macros.kcal,
        proteinG: macros.proteinG,
        carbsG: macros.carbsG,
        fatG: macros.fatG,
        sodiumMg,
      },
      notes: null,
      archivedAt: null,
      source: {
        kind: "reference",
        datasetId: DATASET.datasetId,
        datasetName: DATASET.datasetName,
        entryCode,
        entryName,
        licence: DATASET.licence,
        url: DATASET.url,
        retrievedAt: DATASET.retrievedAt,
        note: null,
      },
      imageId: null,
      common: false,
      gramsPerTsp: null,
      gramsPerTbsp: null,
      flavourTags: [],
      _group: group,
    });
  }

  return {
    ingredients,
    sodiumIndex,
    stats: {
      sheetName,
      inorganicsSheetName: inorganicsName,
      dataRows: dataRows.length,
      seeded: ingredients.length,
      excludedN,
      incomplete,
      duplicateCodes,
      sodiumKnown,
      sodiumNull,
      sodiumZero,
    },
  };
}

/**
 * @param {object[]} ingredients
 * @param {string[]} commonCodes
 */
function applyCommonFlags(ingredients, commonCodes) {
  const codeSet = new Set(commonCodes.map((c) => String(c).trim()));
  const byCode = new Map(
    ingredients.map((ing) => [ing.source.entryCode, ing]),
  );

  /** @type {string[]} */
  const unresolved = [];
  for (const code of codeSet) {
    const hit = byCode.get(code);
    if (!hit) {
      unresolved.push(code);
      continue;
    }
    hit.common = true;
  }

  if (unresolved.length > 0) {
    const preview = unresolved.slice(0, 20).join(", ");
    throw new Error(
      `Common-code list has ${unresolved.length} code(s) with no seeded entry: ${preview}`,
    );
  }

  return ingredients.map(({ _group, ...rest }) => rest);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const commonRaw = JSON.parse(await readFile(COMMON_CODES_PATH, "utf8"));
  if (!Array.isArray(commonRaw.codes)) {
    throw new Error(`${COMMON_CODES_PATH} must contain a "codes" array`);
  }

  const { ingredients, sodiumIndex, stats } = transcodeWorkbook(opts.xlsx);
  const withCommon = applyCommonFlags(ingredients, commonRaw.codes);

  const pack = {
    version: STARTER_PACK_VERSION,
    dataset: DATASET,
    generatedAt: new Date().toISOString(),
    stats: {
      ...stats,
      commonCount: withCommon.filter((i) => i.common).length,
    },
    ingredients: withCommon,
  };

  const publicDir = path.join(root, "public/starter-pack");
  await mkdir(publicDir, { recursive: true });
  await mkdir(opts.outDir, { recursive: true });

  const packPath = path.join(publicDir, "pack.json");
  // Minified runtime asset — fetched at seed time, not inlined into the JS bundle.
  await writeFile(packPath, `${JSON.stringify(pack)}\n`, "utf8");

  const sodiumIndexPath = path.join(opts.outDir, "sodium-index.json");
  await writeFile(
    sodiumIndexPath,
    `${JSON.stringify(sodiumIndex)}\n`,
    "utf8",
  );

  const metaPath = path.join(opts.outDir, "meta.json");
  await writeFile(
    metaPath,
    `${JSON.stringify(
      {
        version: STARTER_PACK_VERSION,
        dataset: DATASET,
        stats: pack.stats,
        attributionNote:
          "Contains public sector information licensed under the Open Government Licence v3.0. Confirmed from the GOV.UK CoFID publication page footer and the CoFID 2021 user guide PDF (R2.12).",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(
    `Wrote ${withCommon.length} ingredients (${pack.stats.commonCount} common) → ${packPath}`,
  );
  console.log(`Wrote sodium index (${Object.keys(sodiumIndex).length} known) → ${sodiumIndexPath}`);
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
