import type Dexie from "dexie";
import {
  IngredientSchema,
  type Ingredient,
  type Settings,
} from "@/domain";
import {
  STARTER_PACK_VERSION,
  loadStarterPack,
  type StarterPackFile,
} from "./meta";
import {
  FLAVOUR_PACK_VERSION,
  loadFlavourPack,
  type FlavourPackFile,
} from "../flavour-pack";

export type StarterPackSeedReport = {
  added: number;
  skippedExisting: number;
  skippedInvalid: number;
  enriched: number;
  archivedRetired: number;
  version: string;
};

export type PackSeedReport = StarterPackSeedReport & {
  pack: "starter" | "flavour";
};

export type DualPackSeedReport = {
  starter: PackSeedReport;
  flavour: PackSeedReport;
};

/**
 * Former allow-list entries removed by later packs. Untouched reference rows
 * are archived on flavour top-up so pickers stop offering them (Architect
 * option 1: branded smoked paprika 579084).
 */
const RETIRED_FLAVOUR_KEYS = new Set(["usda-branded::579084"]);

function entryCodeKey(ingredient: Ingredient): string | null {
  const code = ingredient.source.entryCode;
  const datasetId = ingredient.source.datasetId;
  if (!code || !datasetId) return null;
  return `${datasetId}::${code}`;
}

type PackFile = StarterPackFile | FlavourPackFile;

/**
 * Additive seed by source.entryCode (+ datasetId).
 * Never overwrites an existing row's macros or user edits (ADR-002 / R2.7 / R1.5).
 * Soft-fills null spoon weights on untouched reference rows from the pack (ADR-008).
 * Archives retired flavour-pack reference rows that are no longer allow-listed.
 */
async function seedPackIngredients(
  db: Dexie,
  pack: PackFile,
  options: {
    version: string;
    versionField: "starterPackVersion" | "flavourPackVersion";
    packLabel: "starter" | "flavour";
  },
): Promise<PackSeedReport> {
  const report: PackSeedReport = {
    pack: options.packLabel,
    added: 0,
    skippedExisting: 0,
    skippedInvalid: 0,
    enriched: 0,
    archivedRetired: 0,
    version: options.version,
  };

  await db.transaction(
    "rw",
    [db.table("ingredients"), db.table("settings")],
    async () => {
      const existing = (await db.table("ingredients").toArray()) as Ingredient[];
      const byKey = new Map<string, Ingredient>();
      for (const row of existing) {
        const key = entryCodeKey(row);
        if (key) byKey.set(key, row);
      }

      const toAdd: Ingredient[] = [];
      const toEnrich: Ingredient[] = [];
      for (const raw of pack.ingredients) {
        const parsed = IngredientSchema.safeParse(raw);
        if (!parsed.success) {
          report.skippedInvalid += 1;
          continue;
        }
        const ingredient = parsed.data;
        const key = entryCodeKey(ingredient);
        if (!key) {
          report.skippedInvalid += 1;
          continue;
        }
        const prior = byKey.get(key);
        if (prior) {
          report.skippedExisting += 1;
          // Soft-fill cited spoon weights only when still null on an untouched
          // reference row — never invent, never overwrite a user figure.
          if (
            options.packLabel === "flavour" &&
            prior.source.kind === "reference" &&
            prior.measureKind === "mass"
          ) {
            let next = prior;
            let changed = false;
            if (
              prior.gramsPerTsp == null &&
              ingredient.gramsPerTsp != null
            ) {
              next = { ...next, gramsPerTsp: ingredient.gramsPerTsp };
              changed = true;
            }
            if (
              prior.gramsPerTbsp == null &&
              ingredient.gramsPerTbsp != null
            ) {
              next = { ...next, gramsPerTbsp: ingredient.gramsPerTbsp };
              changed = true;
            }
            if (ingredient.notes != null) {
              const priorNotes = prior.notes ?? "";
              if (
                priorNotes === "" ||
                !priorNotes.toLowerCase().includes("smoked paprika")
              ) {
                // Prefer pack notes when they carry search aliases; keep any
                // prior note text by appending if both are non-empty and distinct.
                if (priorNotes === "") {
                  next = { ...next, notes: ingredient.notes };
                  changed = true;
                } else if (priorNotes !== ingredient.notes) {
                  next = {
                    ...next,
                    notes: `${priorNotes} ${ingredient.notes}`.trim(),
                  };
                  changed = true;
                }
              }
            }
            if (changed) {
              toEnrich.push(next);
              byKey.set(key, next);
            }
          }
          continue;
        }
        toAdd.push(ingredient);
        byKey.set(key, ingredient);
      }

      const toArchive: Ingredient[] = [];
      if (options.packLabel === "flavour") {
        const now = new Date().toISOString();
        for (const row of existing) {
          const key = entryCodeKey(row);
          if (!key || !RETIRED_FLAVOUR_KEYS.has(key)) continue;
          if (row.archivedAt != null) continue;
          // Only auto-archive untouched reference rows — user edits stay.
          if (row.source.kind !== "reference") continue;
          const archived = { ...row, archivedAt: now };
          toArchive.push(archived);
          byKey.set(key, archived);
        }
      }

      if (toAdd.length > 0) {
        await db.table("ingredients").bulkPut(toAdd);
      }
      if (toEnrich.length > 0) {
        await db.table("ingredients").bulkPut(toEnrich);
      }
      if (toArchive.length > 0) {
        await db.table("ingredients").bulkPut(toArchive);
      }
      report.added = toAdd.length;
      report.enriched = toEnrich.length;
      report.archivedRetired = toArchive.length;

      const settingsRow =
        ((await db.table("settings").get("singleton")) as Settings | undefined) ??
        null;
      if (settingsRow) {
        await db.table("settings").put({
          ...settingsRow,
          [options.versionField]: options.version,
        });
      }
    },
  );

  return report;
}

/**
 * Seed the CoFID starter pack only (additive; never overwrite).
 */
export async function seedStarterPack(
  db: Dexie,
  options?: { pack?: StarterPackFile; version?: string },
): Promise<StarterPackSeedReport> {
  const pack = options?.pack ?? (await loadStarterPack());
  const version = options?.version ?? pack.version ?? STARTER_PACK_VERSION;
  const report = await seedPackIngredients(db, pack, {
    version,
    versionField: "starterPackVersion",
    packLabel: "starter",
  });
  return {
    added: report.added,
    skippedExisting: report.skippedExisting,
    skippedInvalid: report.skippedInvalid,
    enriched: report.enriched,
    archivedRetired: report.archivedRetired,
    version: report.version,
  };
}

/**
 * Seed the USDA flavour pack only (additive; never overwrite).
 */
export async function seedFlavourPack(
  db: Dexie,
  options?: { pack?: FlavourPackFile; version?: string },
): Promise<PackSeedReport> {
  const pack = options?.pack ?? (await loadFlavourPack());
  const version = options?.version ?? pack.version ?? FLAVOUR_PACK_VERSION;
  return seedPackIngredients(db, pack, {
    version,
    versionField: "flavourPackVersion",
    packLabel: "flavour",
  });
}

/**
 * Top up both packs through the same additive path (R1.5–R1.6).
 * Reports each pack separately.
 */
export async function seedBothPacks(
  db: Dexie,
  options?: {
    starterPack?: StarterPackFile;
    flavourPack?: FlavourPackFile;
  },
): Promise<DualPackSeedReport> {
  const starter = await seedStarterPack(db, { pack: options?.starterPack });
  const flavour = await seedFlavourPack(db, { pack: options?.flavourPack });
  return {
    starter: { ...starter, pack: "starter" },
    flavour,
  };
}

/**
 * First-run / top-up when either pack watermark differs from the shipped pack.
 */
export async function ensureStarterPackSeeded(
  db: Dexie,
): Promise<DualPackSeedReport | null> {
  const settings = (await db.table("settings").get("singleton")) as
    | Settings
    | undefined;
  const starterOk = settings?.starterPackVersion === STARTER_PACK_VERSION;
  const flavourOk = settings?.flavourPackVersion === FLAVOUR_PACK_VERSION;
  if (starterOk && flavourOk) {
    return null;
  }
  return seedBothPacks(db);
}
