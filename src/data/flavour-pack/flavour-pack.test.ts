import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IngredientSchema } from "@/domain";
import {
  FLAVOUR_PACK_VERSION,
  closeRecipeDb,
  createRecipeDb,
  deleteRecipeDb,
  openRecipeDb,
  seedBothPacks,
  seedFlavourPack,
  setFlavourPackForTests,
  setStarterPackForTests,
  STARTER_PACK_VERSION,
} from "@/data";
import allowList from "@/data/flavour-pack/allow-list.json";
import brandedCache from "@/data/flavour-pack/branded-cache.json";
import cofidEquivalence from "@/data/flavour-pack/cofid-equivalence.json";
import displayAliases from "@/data/flavour-pack/display-aliases.json";
import flavourPackJson from "../../../public/starter-pack/flavour-pack.json";
import packJson from "../../../public/starter-pack/pack.json";
import type { FlavourPackFile } from "@/data/flavour-pack";
import type { StarterPackFile } from "@/data/starter-pack";

const flavourPack = flavourPackJson as FlavourPackFile;
const starterPack = packJson as StarterPackFile;

/** R1.8 — named gaps. Smoked paprika is satisfied by paprika + display alias. */
const NAMED_GAPS = [
  "Paprika",
  "Cumin",
  "Turmeric",
  "Cinnamon",
  "Oregano",
  "Black pepper",
  "Onion powder",
  "MSG",
  "Miso",
  "Fish sauce",
  "Nutritional yeast",
  "Capers",
  "Balsamic vinegar",
  "Cider vinegar",
] as const;

beforeEach(() => {
  setStarterPackForTests(starterPack);
  setFlavourPackForTests(flavourPack);
});

afterEach(async () => {
  setStarterPackForTests(null);
  setFlavourPackForTests(null);
  await closeRecipeDb();
});

describe("flavour pack integrity (ADR-006 / R1.2–R1.4, R1.7)", () => {
  it("uses usda-sr-legacy as the pack dataset id (R1.1)", () => {
    expect(flavourPack.dataset.datasetId).toBe("usda-sr-legacy");
    expect(flavourPack.version).toBe(FLAVOUR_PACK_VERSION);
  });

  it("is driven by a 60–120 entry allow-list (R1.2)", () => {
    expect(allowList.entries.length).toBeGreaterThanOrEqual(60);
    expect(allowList.entries.length).toBeLessThanOrEqual(120);
    expect(flavourPack.ingredients.length).toBe(allowList.entries.length);
  });

  it("fails conceptually on overlap: allow-list ∩ equivalence map is empty (R1.3)", () => {
    const overlapIds = new Set(
      cofidEquivalence.overlaps.map((row) => String(row.fdcId)),
    );
    for (const entry of allowList.entries) {
      expect(
        overlapIds.has(String(entry.fdcId)),
        `allow-list must not include CoFID overlap ${entry.fdcId}`,
      ).toBe(false);
    }
  });

  it("validates every entry through IngredientSchema and marks common (R1.4, R1.7)", () => {
    for (const row of flavourPack.ingredients) {
      expect(() => IngredientSchema.parse(row)).not.toThrow();
      expect(row.common).toBe(true);
      expect(row.measureKind).not.toBe("count");
      expect(row.source.kind).toBe("reference");
      expect(row.source.entryCode).toBeTruthy();
      expect(
        row.source.datasetId === "usda-sr-legacy" ||
          row.source.datasetId === "usda-branded",
      ).toBe(true);
    }
  });

  it("spot-checks every entry's kcal and entryCode against published figures", () => {
    const allowById = new Map(
      allowList.entries.map((e) => [String(e.fdcId), e]),
    );
    for (const row of flavourPack.ingredients) {
      const code = row.source.entryCode!;
      expect(allowById.has(code), `unexpected entryCode ${code}`).toBe(true);
      expect(row.nutrition.kcal).toBeGreaterThanOrEqual(0);

      if (row.source.datasetId === "usda-branded") {
        const cached = brandedCache.foods[code as keyof typeof brandedCache.foods];
        expect(cached).toBeTruthy();
        expect(row.nutrition.kcal).toBe(Math.round(cached.nutritionPer100g.kcal));
        expect(row.nutrition.sodiumMg).toBe(
          Math.round(cached.nutritionPer100g.sodiumMg),
        );
      }
    }
  });
});

describe("flavour pack coverage (R1.8)", () => {
  it("resolves each named gap to exactly one seeded ingredient", () => {
    for (const gap of NAMED_GAPS) {
      const hits = flavourPack.ingredients.filter(
        (ingredient) => ingredient.name.toLowerCase() === gap.toLowerCase(),
      );
      expect(hits, gap).toHaveLength(1);
    }
  });

  it("covers smoked paprika via paprika + documented alias (Architect option 1)", () => {
    expect(
      flavourPack.ingredients.some((i) => i.source.entryCode === "579084"),
    ).toBe(false);
    expect(allowList.entries.some((e) => String(e.fdcId) === "579084")).toBe(
      false,
    );

    const paprika = flavourPack.ingredients.filter(
      (ingredient) => ingredient.name.toLowerCase() === "paprika",
    );
    expect(paprika).toHaveLength(1);
    expect(paprika[0]?.source.entryCode).toBe("171329");
    expect(paprika[0]?.notes?.toLowerCase()).toContain("smoked paprika");

    const alias = displayAliases.aliases.find(
      (row) => row.alias.toLowerCase() === "smoked paprika",
    );
    expect(alias).toMatchObject({
      alias: "smoked paprika",
      datasetId: "usda-sr-legacy",
      entryCode: "171329",
      displayName: "Paprika",
    });
  });

  it("populates cited spoon weights without deriving tbsp from tsp (R3.1–R3.2)", () => {
    const paprika = flavourPack.ingredients.find((i) => i.name === "Paprika")!;
    expect(paprika.gramsPerTsp).toBe(2.3);
    expect(paprika.gramsPerTbsp).toBe(6.8);

    const withTsp = flavourPack.ingredients.filter((i) => i.gramsPerTsp != null);
    const withTbsp = flavourPack.ingredients.filter(
      (i) => i.gramsPerTbsp != null,
    );
    expect(withTsp.length).toBeGreaterThan(0);
    expect(withTbsp.length).toBeGreaterThan(0);
  });
});

describe("flavour pack seeding (R1.5–R1.6)", () => {
  it("seeds additively beside CoFID and watermarks flavourPackVersion separately", async () => {
    const name = `flavour-pack-${crypto.randomUUID()}`;
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
      flavourPackVersion: null,
    });

    const report = await seedBothPacks(db, {
      starterPack,
      flavourPack,
    });
    expect(report.starter.added).toBe(starterPack.ingredients.length);
    expect(report.flavour.added).toBe(flavourPack.ingredients.length);

    const settings = await db.table("settings").get("singleton");
    expect(settings?.starterPackVersion).toBe(STARTER_PACK_VERSION);
    expect(settings?.flavourPackVersion).toBe(FLAVOUR_PACK_VERSION);

    const paprika = await db
      .table("ingredients")
      .filter((row) => row.name === "Paprika")
      .toArray();
    expect(paprika).toHaveLength(1);

    const second = await seedBothPacks(db, {
      starterPack,
      flavourPack,
    });
    expect(second.starter.added).toBe(0);
    expect(second.flavour.added).toBe(0);
    expect(second.starter.skippedExisting).toBe(starterPack.ingredients.length);
    expect(second.flavour.skippedExisting).toBe(flavourPack.ingredients.length);

    await db.close();
    await deleteRecipeDb(name);
  });

  it("never overwrites an edited flavour-pack row", async () => {
    const name = `flavour-pack-edit-${crypto.randomUUID()}`;
    const db = await openRecipeDb({ name, ephemeral: true });

    await seedFlavourPack(db, { pack: flavourPack });
    const cumin = flavourPack.ingredients.find((i) => i.name === "Cumin")!;
    const edited = {
      ...cumin,
      nutrition: { ...cumin.nutrition, kcal: cumin.nutrition.kcal + 10 },
      source: { ...cumin.source, kind: "userEntered" as const, note: "Adjusted" },
    };
    await db.table("ingredients").put(edited);

    const report = await seedFlavourPack(db, { pack: flavourPack });
    expect(report.added).toBe(0);

    const after = await db.table("ingredients").get(cumin.id);
    expect(after?.nutrition.kcal).toBe(edited.nutrition.kcal);
    expect(after?.source.kind).toBe("userEntered");

    await db.close();
    await deleteRecipeDb(name);
  });

  it("soft-fills null spoon weights and archives retired smoked paprika", async () => {
    const name = `flavour-pack-enrich-${crypto.randomUUID()}`;
    const db = await openRecipeDb({ name, ephemeral: true });

    const paprika = flavourPack.ingredients.find((i) => i.name === "Paprika")!;
    const barePaprika = {
      ...paprika,
      gramsPerTsp: null,
      gramsPerTbsp: null,
      notes: null,
    };
    const retiredSmoked = {
      ...paprika,
      id: "99999999-9999-4999-8999-999999999999",
      name: "Smoked paprika",
      gramsPerTsp: null,
      gramsPerTbsp: null,
      notes: null,
      source: {
        ...paprika.source,
        datasetId: "usda-branded",
        entryCode: "579084",
        entryName: "SMOKED PAPRIKA",
      },
    };
    await db.table("ingredients").bulkPut([barePaprika, retiredSmoked]);

    const report = await seedFlavourPack(db, { pack: flavourPack });
    expect(report.enriched).toBeGreaterThanOrEqual(1);
    expect(report.archivedRetired).toBe(1);

    const afterPaprika = await db.table("ingredients").get(paprika.id);
    expect(afterPaprika?.gramsPerTsp).toBe(paprika.gramsPerTsp);
    expect(afterPaprika?.gramsPerTbsp).toBe(paprika.gramsPerTbsp);
    expect(afterPaprika?.notes?.toLowerCase()).toContain("smoked paprika");

    const afterSmoked = await db.table("ingredients").get(retiredSmoked.id);
    expect(afterSmoked?.archivedAt).toBeTruthy();

    await db.close();
    await deleteRecipeDb(name);
  });
});
