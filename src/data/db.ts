import type Dexie from "dexie";
import {
  createSongaraDb,
  songaraDbName,
} from "@songara/pwa-base/preview/dexie";
import {
  RECIPE_APP_ID,
  RECIPE_DB_KEY,
  recipeSchemaVersions,
} from "./schema";
import {
  DEFAULT_MEAL_SLOTS,
  STARTER_CATEGORIES,
  defaultSettings,
} from "./seeds";

let singleton: Dexie | null = null;
let openPromise: Promise<Dexie> | null = null;

export function recipeDbName(dbKey: string = RECIPE_DB_KEY): string {
  return songaraDbName(RECIPE_APP_ID, dbKey);
}

/** Create an unopened Dexie instance with Recipe schema versions applied. */
export function createRecipeDb(name?: string): Dexie {
  return createSongaraDb({
    name: name ?? recipeDbName(),
    versions: recipeSchemaVersions,
  });
}

/**
 * Seed meal slots, starter categories, and settings singleton when empty.
 * Idempotent — never overwrites existing rows.
 */
export async function seedDefaults(db: Dexie): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.table("mealSlots"),
      db.table("ingredientCategories"),
      db.table("settings"),
    ],
    async () => {
      const slotCount = await db.table("mealSlots").count();
      if (slotCount === 0) {
        await db.table("mealSlots").bulkPut(DEFAULT_MEAL_SLOTS);
      }

      const categoryCount = await db.table("ingredientCategories").count();
      if (categoryCount === 0) {
        await db.table("ingredientCategories").bulkPut(STARTER_CATEGORIES);
      }

      const settings = await db.table("settings").get("singleton");
      if (!settings) {
        await db.table("settings").put(defaultSettings());
      }
    },
  );
}

/** Open (or reuse) the app database and apply first-run seeds. */
export async function openRecipeDb(options?: {
  name?: string;
  /** When true, skip the process-wide singleton (tests). */
  ephemeral?: boolean;
}): Promise<Dexie> {
  if (!options?.ephemeral && !options?.name) {
    if (singleton) return singleton;
    if (openPromise) return openPromise;
    openPromise = (async () => {
      const db = createRecipeDb();
      await db.open();
      await seedDefaults(db);
      singleton = db;
      return db;
    })();
    return openPromise;
  }

  const db = createRecipeDb(options.name);
  await db.open();
  await seedDefaults(db);
  return db;
}

/** Close and forget the process singleton (tests / teardown). */
export async function closeRecipeDb(): Promise<void> {
  if (singleton) {
    singleton.close();
    singleton = null;
  }
  openPromise = null;
}

export async function deleteRecipeDb(name?: string): Promise<void> {
  const dbName = name ?? recipeDbName();
  await closeRecipeDb();
  await createSongaraDb({
    name: dbName,
    versions: recipeSchemaVersions,
  }).delete();
}
