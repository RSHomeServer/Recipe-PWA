import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IngredientSchema, defaultUserEnteredSource } from "@/domain";
import {
  SEED_CATEGORY_IDS,
  closeRecipeDb,
  createRecipeDb,
  deleteRecipeDb,
  openRecipeDb,
  seedStarterPack,
  setStarterPackForTests,
  STARTER_PACK_VERSION,
} from "@/data";
import { partitionCommonFirst } from "@/data/starter-pack/common-first";
import commonCodes from "@/data/starter-pack/common-codes.json";
import packJson from "../../../public/starter-pack/pack.json";
import type { StarterPackFile } from "@/data/starter-pack";

const starterPack = packJson as StarterPackFile;

beforeEach(() => {
  setStarterPackForTests(starterPack);
});

afterEach(async () => {
  setStarterPackForTests(null);
  await closeRecipeDb();
});

describe("starter pack (ADR-002 / R2.5–R2.9)", () => {
  it("validates every pack entry through IngredientSchema (R2.9)", () => {
    expect(starterPack.ingredients.length).toBeGreaterThan(500);
    for (const row of starterPack.ingredients) {
      expect(() => IngredientSchema.parse(row)).not.toThrow();
      expect(row.measureKind).not.toBe("count");
      expect(row.source.kind).toBe("reference");
      expect(row.source.datasetId).toBe("cofid-2021");
      expect(row.source.entryCode).toBeTruthy();
    }
  });

  it("spot-checks one entry per category plus a volume alcohol entry (test 3)", () => {
    const byCategory = new Map<string, (typeof starterPack.ingredients)[0]>();
    for (const ingredient of starterPack.ingredients) {
      if (ingredient.categoryId && !byCategory.has(ingredient.categoryId)) {
        byCategory.set(ingredient.categoryId, ingredient);
      }
    }

    for (const id of Object.values(SEED_CATEGORY_IDS)) {
      const sample = byCategory.get(id);
      expect(sample, `missing sample for category ${id}`).toBeTruthy();
      expect(sample!.nutrition.kcal).toBeGreaterThanOrEqual(0);
      expect(sample!.source.entryCode).toMatch(/^\d/);
    }

    const volume = starterPack.ingredients.find(
      (ingredient) => ingredient.measureKind === "volume",
    );
    expect(volume).toBeTruthy();
    expect(volume!.source.entryCode).toBeTruthy();
    const beer = starterPack.ingredients.find(
      (ingredient) => ingredient.source.entryCode === "17-506",
    );
    expect(beer?.measureKind).toBe("volume");
    expect(beer?.nutrition.kcal).toBe(30);
  });

  it("maps Tr→0 and excludes N foods from named real entries (test 3b)", () => {
    const agar = starterPack.ingredients.find(
      (ingredient) => ingredient.source.entryCode === "13-146",
    );
    expect(agar).toBeTruthy();
    expect(agar!.nutrition.carbsG).toBe(0);
    expect(agar!.nutrition.kcal).toBe(16);

    const allspice = starterPack.ingredients.find(
      (ingredient) => ingredient.source.entryCode === "13-801",
    );
    expect(allspice).toBeUndefined();
  });

  it("resolves every common code or fails (test 3a / R2.5b)", () => {
    const codes = new Set(
      starterPack.ingredients.map(
        (ingredient) => ingredient.source.entryCode!,
      ),
    );
    for (const code of commonCodes.codes) {
      expect(codes.has(code), `common code missing: ${code}`).toBe(true);
    }
    const commonCount = starterPack.ingredients.filter((i) => i.common).length;
    expect(commonCount).toBe(commonCodes.codes.length);
  });

  it("covers the weekly-pattern common foods (R2.6)", () => {
    const required = [
      "18-289",
      "18-295",
      "18-317",
      "18-319",
      "13-533",
      "13-527",
      "13-543",
      "13-502",
      "17-705",
      "17-709",
    ];
    for (const code of required) {
      const hit = starterPack.ingredients.find(
        (ingredient) => ingredient.source.entryCode === code,
      );
      expect(hit?.common, code).toBe(true);
    }
  });

  it("seeds additively and never overwrites edited rows (test 4)", async () => {
    const name = `starter-pack-${crypto.randomUUID()}`;
    const db = await openRecipeDb({ name, ephemeral: true });

    const first = await seedStarterPack(db, { pack: starterPack });
    expect(first.added).toBe(0);
    expect(first.skippedExisting).toBe(starterPack.ingredients.length);

    const settings = await db.table("settings").get("singleton");
    expect(settings?.starterPackVersion).toBe(STARTER_PACK_VERSION);

    const chicken = starterPack.ingredients.find(
      (ingredient) => ingredient.source.entryCode === "18-289",
    )!;
    const edited = {
      ...chicken,
      nutrition: { ...chicken.nutrition, kcal: chicken.nutrition.kcal + 50 },
      source: {
        ...chicken.source,
        kind: "userEntered" as const,
        note: "Adjusted",
      },
    };
    await db.table("ingredients").put(edited);

    const second = await seedStarterPack(db, { pack: starterPack });
    expect(second.added).toBe(0);
    expect(second.skippedExisting).toBe(starterPack.ingredients.length);

    const after = await db.table("ingredients").get(chicken.id);
    expect(after?.nutrition.kcal).toBe(edited.nutrition.kcal);
    expect(after?.source.kind).toBe("userEntered");
    expect(after?.source.entryCode).toBe("18-289");

    await db.close();
    await deleteRecipeDb(name);
  });

  it("adds only missing codes on a fresh top-up after delete", async () => {
    const name = `starter-pack-topup-${crypto.randomUUID()}`;
    const db = createRecipeDb(name);
    await db.open();
    await db.table("settings").put({
      id: "singleton",
      dailyCalorieTarget: null,
      weekStartsOn: 1,
      themePreference: "system",
      shoppingWindow: null,
      howItWorksDismissed: false,
      starterPackVersion: null,
    });

    const report = await seedStarterPack(db, { pack: starterPack });
    expect(report.added).toBe(starterPack.ingredients.length);

    const one = starterPack.ingredients[0]!;
    await db.table("ingredients").delete(one.id);

    const topUp = await seedStarterPack(db, { pack: starterPack });
    expect(topUp.added).toBe(1);
    expect(topUp.skippedExisting).toBe(starterPack.ingredients.length - 1);

    await db.close();
    await deleteRecipeDb(name);
  });
});

describe("partitionCommonFirst", () => {
  it("hides non-common until showAll", () => {
    const items = [
      { id: "a", common: true },
      { id: "b", common: false },
      { id: "c", common: true },
    ];
    const closed = partitionCommonFirst(items);
    expect(closed.visible.map((i) => i.id)).toEqual(["a", "c"]);
    expect(closed.hiddenCount).toBe(1);

    const open = partitionCommonFirst(items, { showAll: true });
    expect(open.visible.map((i) => i.id)).toEqual(["a", "c", "b"]);
    expect(open.hiddenCount).toBe(0);
  });
});

describe("defaultUserEnteredSource", () => {
  it("stays available for hand-created ingredients", () => {
    expect(defaultUserEnteredSource().kind).toBe("userEntered");
  });
});
