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
  version: string;
};

export type PackSeedReport = StarterPackSeedReport & {
  pack: "starter" | "flavour";
};

export type DualPackSeedReport = {
  starter: PackSeedReport;
  flavour: PackSeedReport;
};

function entryCodeKey(ingredient: Ingredient): string | null {
  const code = ingredient.source.entryCode;
  const datasetId = ingredient.source.datasetId;
  if (!code || !datasetId) return null;
  return `${datasetId}::${code}`;
}

type PackFile = StarterPackFile | FlavourPackFile;

/**
 * Additive seed by source.entryCode (+ datasetId).
 * Never overwrites an existing row — edited or not (ADR-002 / R2.7 / R1.5).
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
        if (byKey.has(key)) {
          report.skippedExisting += 1;
          continue;
        }
        toAdd.push(ingredient);
        byKey.set(key, ingredient);
      }

      if (toAdd.length > 0) {
        await db.table("ingredients").bulkPut(toAdd);
      }
      report.added = toAdd.length;

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
