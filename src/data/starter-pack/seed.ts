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

export type StarterPackSeedReport = {
  added: number;
  skippedExisting: number;
  skippedInvalid: number;
  version: string;
};

function entryCodeKey(ingredient: Ingredient): string | null {
  const code = ingredient.source.entryCode;
  const datasetId = ingredient.source.datasetId;
  if (!code || !datasetId) return null;
  return `${datasetId}::${code}`;
}

/**
 * Additive seed by source.entryCode (+ datasetId).
 * Never overwrites an existing row — edited or not (ADR-002 / R2.7).
 */
export async function seedStarterPack(
  db: Dexie,
  options?: { pack?: StarterPackFile; version?: string },
): Promise<StarterPackSeedReport> {
  const pack = options?.pack ?? (await loadStarterPack());
  const version = options?.version ?? pack.version ?? STARTER_PACK_VERSION;

  const report: StarterPackSeedReport = {
    added: 0,
    skippedExisting: 0,
    skippedInvalid: 0,
    version,
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
          starterPackVersion: version,
        });
      }
    },
  );

  return report;
}

/**
 * First-run / top-up when settings.starterPackVersion differs from the pack.
 */
export async function ensureStarterPackSeeded(
  db: Dexie,
): Promise<StarterPackSeedReport | null> {
  const settings = (await db.table("settings").get("singleton")) as
    | Settings
    | undefined;
  if (settings?.starterPackVersion === STARTER_PACK_VERSION) {
    return null;
  }
  return seedStarterPack(db);
}
