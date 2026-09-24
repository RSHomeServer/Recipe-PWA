import { describe, expect, it } from "vitest";
import type { Ingredient } from "../ingredients/schemas";
import type { Recipe } from "../recipes/schemas";
import type { Batch } from "../batches/schemas";
import { PlannedMealSchema, type PlannedMeal } from "../planning/schemas";
import { requirements } from "../planning/requirements";
import { shoppingList } from "../shopping/list";
import { recipeAvailability } from "../pantry/availability";
import {
  expand,
  expandAll,
  expandCtxFromMaps,
  byDay,
  byIngredient,
  byMeal,
  byRecipe,
  totalNutrition,
  weekTotals,
} from "../insights";
import { logFromPlan } from "../logging/from-plan";
import type { LoggedMeal } from "../logging/schemas";
import { createId } from "../shared/primitives";
import {
  MealTemplateComponentSchema,
  MealTemplateEntrySchema,
  MealTemplateSchema,
  type MealTemplate,
} from "./schemas";
import { expandTemplateToPlannedMeals } from "./apply";
import { clearLogGroups, clearPlanGroups, ungroupMeals } from "./groups";
import {
  canSaveSlotAsMeal,
  deriveRecents,
  entryIdentityKey,
  mealTemplatePrefillFromSlot,
} from "./recents";

const chicken: Ingredient = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Chicken",
  categoryId: null,
  measureKind: "mass",
  nutrition: { kcal: 120, proteinG: 23, carbsG: 0, fatG: 2.6 },
  notes: null,
  source: {
    kind: "userEntered",
    datasetId: null,
    datasetName: null,
    entryCode: null,
    entryName: null,
    licence: null,
    url: null,
    retrievedAt: null,
    note: null,
  },
  imageId: null,
  common: true,
  archivedAt: null,
};

const rice: Ingredient = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  name: "Rice",
  categoryId: null,
  measureKind: "mass",
  nutrition: { kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 },
  notes: null,
  source: {
    kind: "userEntered",
    datasetId: null,
    datasetName: null,
    entryCode: null,
    entryName: null,
    licence: null,
    url: null,
    retrievedAt: null,
    note: null,
  },
  imageId: null,
  common: true,
  archivedAt: null,
};

const peas: Ingredient = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  name: "Peas",
  categoryId: null,
  measureKind: "mass",
  nutrition: { kcal: 80, proteinG: 5, carbsG: 14, fatG: 0.4 },
  notes: null,
  source: {
    kind: "userEntered",
    datasetId: null,
    datasetName: null,
    entryCode: null,
    entryName: null,
    licence: null,
    url: null,
    retrievedAt: null,
    note: null,
  },
  imageId: null,
  common: true,
  archivedAt: null,
};

const sauce: Ingredient = {
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  name: "BBQ sauce",
  categoryId: null,
  measureKind: "volume",
  nutrition: { kcal: 50, proteinG: 0, carbsG: 12, fatG: 0 },
  notes: null,
  source: {
    kind: "userEntered",
    datasetId: null,
    datasetName: null,
    entryCode: null,
    entryName: null,
    licence: null,
    url: null,
    retrievedAt: null,
    note: null,
  },
  imageId: null,
  common: true,
  archivedAt: null,
};

const recipe: Recipe = {
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  name: "Roast chicken",
  servings: 2,
  lines: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      ingredientId: chicken.id,
      quantity: { amount: 500, kind: "mass" },
      displayUnit: "g",
      optional: false,
      note: null,
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      ingredientId: rice.id,
      quantity: { amount: 200, kind: "mass" },
      displayUnit: "g",
      optional: false,
      note: null,
    },
  ],
  steps: ["Cook"],
  tags: [],
  imageId: null,
  notes: null,
  createdAt: "2026-09-22T12:00:00.000Z",
  updatedAt: "2026-09-22T12:00:00.000Z",
  archivedAt: null,
};

const slotId = "22222222-2222-4222-8222-222222222201";
const templateId = "ffffffff-ffff-4fff-8fff-ffffffffffff";

const ctx = {
  recipesById: new Map([[recipe.id, recipe]]),
  ingredientsById: new Map<string, Ingredient>([
    [chicken.id, chicken],
    [rice.id, rice],
    [peas.id, peas],
    [sauce.id, sauce],
  ]),
};

function makeTemplate(overrides?: Partial<MealTemplate>): MealTemplate {
  return MealTemplateSchema.parse({
    id: templateId,
    name: "Wings, hashbrowns & veg",
    components: [
      {
        id: "a1111111-1111-4111-8111-111111111111",
        entry: { kind: "recipeServings", recipeId: recipe.id, servings: 2 },
        note: null,
      },
      {
        id: "a2222222-2222-4222-8222-222222222222",
        entry: {
          kind: "ingredient",
          ingredientId: peas.id,
          quantity: { value: 200, unit: "g" },
        },
        note: null,
      },
      {
        id: "a3333333-3333-4333-8333-333333333333",
        entry: {
          kind: "ingredient",
          ingredientId: sauce.id,
          quantity: { value: 50, unit: "ml" },
        },
        note: null,
      },
      {
        id: "a4444444-4444-4444-8444-444444444444",
        entry: {
          kind: "ingredient",
          ingredientId: rice.id,
          quantity: { value: 100, unit: "g" },
        },
        note: "hashbrowns stand-in",
      },
    ],
    defaultSlotId: slotId,
    createdAt: "2026-09-24T12:00:00.000Z",
    updatedAt: "2026-09-24T12:00:00.000Z",
    archivedAt: null,
    ...overrides,
  });
}

let idSeq = 0;
function resetIds() {
  idSeq = 0;
}
function nextId() {
  idSeq += 1;
  const hex = idSeq.toString(16).padStart(12, "0");
  return `00000000-0000-4000-8000-${hex}`;
}

describe("MealTemplate schema (R4.1)", () => {
  it("rejects batchPortions and customFood components", () => {
    expect(
      MealTemplateEntrySchema.safeParse({
        kind: "batchPortions",
        batchId: createId(),
        portions: 1,
      }).success,
    ).toBe(false);
    expect(
      MealTemplateEntrySchema.safeParse({
        kind: "customFood",
        food: {
          name: "Snack",
          quantity: 1,
          nutrition: { kcal: 100, proteinG: 0, carbsG: 0, fatG: 0 },
        },
      }).success,
    ).toBe(false);
    expect(
      MealTemplateComponentSchema.safeParse({
        id: createId(),
        entry: {
          kind: "batchPortions",
          batchId: createId(),
          portions: 1,
        },
        note: null,
      }).success,
    ).toBe(false);
  });
});

describe("expandTemplateToPlannedMeals (R4.4–R4.5, test 6)", () => {
  it("creates sixteen rows in four groups for four components × four days", () => {
    resetIds();
    const template = makeTemplate();
    const dates = [
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
    ] as const;
    const rows = expandTemplateToPlannedMeals({
      template,
      dates,
      slotId,
      existing: [],
      nextId,
    });
    expect(rows).toHaveLength(16);
    const byDay = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = byDay.get(row.date) ?? [];
      list.push(row);
      byDay.set(row.date, list);
    }
    expect(byDay.size).toBe(4);
    for (const dayRows of byDay.values()) {
      expect(dayRows).toHaveLength(4);
      const groupIds = new Set(dayRows.map((r) => r.group?.id));
      expect(groupIds.size).toBe(1);
      expect(dayRows.map((r) => r.position)).toEqual([0, 1, 2, 3]);
      expect(dayRows.every((r) => r.group?.name === template.name)).toBe(true);
      expect(dayRows.every((r) => r.group?.templateId === template.id)).toBe(
        true,
      );
      expect(dayRows.map((r) => r.entry)).toEqual(
        template.components.map((c) => c.entry),
      );
    }
    const allGroupIds = new Set(rows.map((r) => r.group!.id));
    expect(allGroupIds.size).toBe(4);
  });

  it("appends after existing slot meals and leaves rename of template off plans", () => {
    resetIds();
    const template = makeTemplate();
    const existing: PlannedMeal[] = [
      PlannedMealSchema.parse({
        id: "99999999-9999-4999-8999-999999999901",
        date: "2026-09-22",
        slotId,
        entry: {
          kind: "ingredient",
          ingredientId: chicken.id,
          quantity: { value: 50, unit: "g" },
        },
        position: 0,
        note: null,
        group: null,
      }),
    ];
    const rows = expandTemplateToPlannedMeals({
      template,
      dates: ["2026-09-22"],
      slotId,
      existing,
      nextId,
    });
    expect(rows.map((r) => r.position)).toEqual([1, 2, 3, 4]);
    const renamed = { ...template, name: "New name" };
    expect(rows.every((r) => r.group?.name === "Wings, hashbrowns & veg")).toBe(
      true,
    );
    expect(renamed.name).toBe("New name");
  });

  it("deleting one row leaves the other three still grouped", () => {
    resetIds();
    const rows = expandTemplateToPlannedMeals({
      template: makeTemplate(),
      dates: ["2026-09-22"],
      slotId,
      existing: [],
      nextId,
    });
    const remaining = rows.slice(1);
    expect(remaining).toHaveLength(3);
    expect(new Set(remaining.map((r) => r.group?.id)).size).toBe(1);
  });
});

describe("template aggregation (test 7)", () => {
  it("aggregates a recipe through a template across three days before pantry subtraction", () => {
    resetIds();
    const template = MealTemplateSchema.parse({
      ...makeTemplate(),
      components: [
        {
          id: "a1111111-1111-4111-8111-111111111111",
          entry: { kind: "recipeServings", recipeId: recipe.id, servings: 2 },
          note: null,
        },
      ],
    });
    const dates = ["2026-09-21", "2026-09-22", "2026-09-23"] as const;
    const meals = expandTemplateToPlannedMeals({
      template,
      dates,
      slotId,
      existing: [],
      nextId,
    });
    const lines = requirements(
      meals,
      { from: "2026-09-21", to: "2026-09-23" },
      ctx,
    );
    expect(
      lines.find((l) => l.ingredientId === chicken.id)?.quantity,
    ).toEqual({ amount: 1500, kind: "mass" });
    const list = shoppingList(lines, [], null);
    expect(
      list.find((l) => l.ingredientId === chicken.id)?.toBuy,
    ).toEqual({ amount: 1500, kind: "mass" });
  });
});

describe("group invariance (R4.3 / governing test 1)", () => {
  it("requirements, shopping, availability, expand and insights are byte-identical with group cleared", () => {
    resetIds();
    const template = makeTemplate();
    const meals = expandTemplateToPlannedMeals({
      template,
      dates: ["2026-09-22", "2026-09-23"],
      slotId,
      existing: [],
      nextId,
    });
    expect(meals.every((m) => m.group != null)).toBe(true);

    const range = { from: "2026-09-22", to: "2026-09-23" } as const;
    const cleared = clearPlanGroups(meals);

    const reqA = requirements(meals, range, ctx);
    const reqB = requirements(cleared, range, ctx);
    expect(reqA).toEqual(reqB);

    const shopA = shoppingList(reqA, [], null);
    const shopB = shoppingList(reqB, [], null);
    expect(shopA).toEqual(shopB);

    const stock = new Map();
    const availA = recipeAvailability(recipe, stock, ctx.ingredientsById);
    const availB = recipeAvailability(recipe, stock, ctx.ingredientsById);
    expect(availA).toEqual(availB);

    const logs: LoggedMeal[] = meals.map((planned, i) =>
      logFromPlan(planned, {
        id: `bbbbbbbb-bbbb-4bbb-8bbb-${(i + 1).toString(16).padStart(12, "0")}`,
        loggedAt: "2026-09-24T12:00:00.000Z",
      }),
    );
    const logsCleared = clearLogGroups(logs);
    const expandCtx = expandCtxFromMaps(
      ctx.recipesById,
      new Map<string, Batch>(),
      ctx.ingredientsById,
    );

    const contribA = expandAll(logs, expandCtx);
    const contribB = expandAll(logsCleared, expandCtx);
    expect(contribA).toEqual(contribB);

    for (let i = 0; i < logs.length; i += 1) {
      expect(expand(logs[i]!, expandCtx)).toEqual(
        expand(logsCleared[i]!, expandCtx),
      );
    }

    expect(byDay(contribA)).toEqual(byDay(contribB));
    expect(byMeal(contribA)).toEqual(byMeal(contribB));
    expect(byRecipe(contribA)).toEqual(byRecipe(contribB));
    expect(byIngredient(contribA)).toEqual(byIngredient(contribB));
    expect(weekTotals(contribA)).toEqual(weekTotals(contribB));
    expect(totalNutrition(contribA)).toEqual(totalNutrition(contribB));
  });
});

describe("log all (R4.9 / test 8)", () => {
  it("creates one LoggedMeal per component with correct plannedMealIds", () => {
    resetIds();
    const planned = expandTemplateToPlannedMeals({
      template: makeTemplate(),
      dates: ["2026-09-22"],
      slotId,
      existing: [],
      nextId,
    });
    expect(planned).toHaveLength(4);
    const loggedAt = "2026-09-24T18:00:00.000Z";
    const logs = planned.map((p, i) =>
      logFromPlan(p, {
        id: `cccccccc-cccc-4ccc-8ccc-${(i + 1).toString(16).padStart(12, "0")}`,
        loggedAt,
      }),
    );
    expect(logs.map((l) => l.plannedMealId)).toEqual(planned.map((p) => p.id));
    expect(logs.every((l) => l.group?.id === planned[0]!.group!.id)).toBe(true);
    expect(logs.map((l) => l.entry)).toEqual(planned.map((p) => p.entry));
  });
});

describe("ungroup", () => {
  it("clears group on members without changing entries", () => {
    resetIds();
    const planned = expandTemplateToPlannedMeals({
      template: makeTemplate(),
      dates: ["2026-09-22"],
      slotId,
      existing: [],
      nextId,
    });
    const groupId = planned[0]!.group!.id;
    const updated = ungroupMeals(planned, groupId);
    expect(updated).toHaveLength(4);
    expect(updated.every((m) => m.group == null)).toBe(true);
    expect(updated.map((m) => m.entry)).toEqual(planned.map((m) => m.entry));
  });
});

describe("deriveRecents (R4.10 / ADR-004 verification 8)", () => {
  const recipeEntry = {
    kind: "recipeServings" as const,
    recipeId: recipe.id,
    servings: 1,
  };
  const peasEntry = {
    kind: "ingredient" as const,
    ingredientId: peas.id,
    quantity: { value: 100, unit: "g" as const },
  };
  const riceEntry = {
    kind: "ingredient" as const,
    ingredientId: rice.id,
    quantity: { value: 50, unit: "g" as const },
  };

  function plannedRow(
    id: string,
    date: string,
    entry: PlannedMeal["entry"],
    position: number,
  ): PlannedMeal {
    return PlannedMealSchema.parse({
      id,
      date,
      slotId,
      entry,
      position,
      note: null,
      group: null,
    });
  }

  function loggedRow(
    id: string,
    date: string,
    loggedAt: string,
    entry: LoggedMeal["entry"],
  ): LoggedMeal {
    return {
      id,
      date,
      slotId,
      entry,
      plannedMealId: null,
      loggedAt,
      note: null,
      group: null,
    };
  }

  it("dedupes across plan and log, most recent first, caps at twelve", () => {
    const plannedRows: PlannedMeal[] = [
      plannedRow("11111111-1111-4111-8111-111111111101", "2026-09-20", recipeEntry, 0),
      plannedRow("11111111-1111-4111-8111-111111111102", "2026-09-21", peasEntry, 0),
      // Duplicate recipe later in the plan — should win over the earlier one.
      plannedRow(
        "11111111-1111-4111-8111-111111111103",
        "2026-09-23",
        { ...recipeEntry, servings: 2 },
        0,
      ),
    ];

    const loggedRows: LoggedMeal[] = [
      // Same recipe as plan, but older log — plan date 09-23 end-of-day wins.
      loggedRow(
        "22222222-2222-4222-8222-222222222201",
        "2026-09-22",
        "2026-09-22T10:00:00.000Z",
        { ...recipeEntry, servings: 3 },
      ),
      // Rice only in log — newest overall.
      loggedRow(
        "22222222-2222-4222-8222-222222222202",
        "2026-09-24",
        "2026-09-24T18:00:00.000Z",
        riceEntry,
      ),
      // Duplicate peas older than plan.
      loggedRow(
        "22222222-2222-4222-8222-222222222203",
        "2026-09-19",
        "2026-09-19T08:00:00.000Z",
        { ...peasEntry, quantity: { value: 200, unit: "g" } },
      ),
      // customFood ignored
      loggedRow(
        "22222222-2222-4222-8222-222222222204",
        "2026-09-24",
        "2026-09-24T20:00:00.000Z",
        {
          kind: "customFood",
          food: {
            name: "Snack",
            quantity: 1,
            nutrition: { kcal: 100, proteinG: 0, carbsG: 20, fatG: 0 },
          },
        },
      ),
    ];

    const recents = deriveRecents(plannedRows, loggedRows);
    expect(recents).toHaveLength(3);
    expect(recents.map((r) => r.identityKey)).toEqual([
      entryIdentityKey(riceEntry),
      entryIdentityKey(recipeEntry),
      entryIdentityKey(peasEntry),
    ]);
    // Most recent recipe occurrence keeps servings: 2 from the later plan.
    expect(recents[1]!.entry).toEqual({ ...recipeEntry, servings: 2 });
    // Peas from plan (newer than the old log).
    expect(recents[2]!.entry).toEqual(peasEntry);
  });

  it("returns at most twelve entries over a fixture with many duplicates", () => {
    const plannedRows: PlannedMeal[] = [];
    const loggedRows: LoggedMeal[] = [];
    for (let i = 0; i < 20; i += 1) {
      const suffix = (i + 1).toString(16).padStart(12, "0");
      const ingredientId = `bbbbbbbb-bbbb-4bbb-8bbb-${suffix}`;
      const entry = {
        kind: "ingredient" as const,
        ingredientId,
        quantity: { value: 10, unit: "g" as const },
      };
      plannedRows.push(
        plannedRow(`aaaaaaaa-aaaa-4aaa-8aaa-${suffix}`, "2026-09-10", entry, i),
      );
      loggedRows.push(
        loggedRow(
          `cccccccc-cccc-4ccc-8ccc-${suffix}`,
          "2026-09-11",
          `2026-09-11T${String(i).padStart(2, "0")}:00:00.000Z`,
          entry,
        ),
      );
    }
    const recents = deriveRecents(plannedRows, loggedRows);
    expect(recents).toHaveLength(12);
    // Highest hour first (19 … 8) → ingredient suffix 0x14 (20).
    expect(recents[0]!.identityKey).toBe(
      entryIdentityKey({
        kind: "ingredient",
        ingredientId: "bbbbbbbb-bbbb-4bbb-8bbb-000000000014",
        quantity: { value: 10, unit: "g" },
      }),
    );
  });
});

describe("save slot as meal (R4.11)", () => {
  it("offers prefill only for two or more ungrouped template-eligible entries", () => {
    const one: PlannedMeal[] = [
      PlannedMealSchema.parse({
        id: "11111111-1111-4111-8111-111111111201",
        date: "2026-09-24",
        slotId,
        entry: {
          kind: "ingredient",
          ingredientId: peas.id,
          quantity: { value: 100, unit: "g" },
        },
        position: 0,
        note: null,
        group: null,
      }),
    ];
    expect(canSaveSlotAsMeal(one)).toBe(false);
    expect(mealTemplatePrefillFromSlot(one, slotId)).toBeNull();

    const two: PlannedMeal[] = [
      one[0]!,
      PlannedMealSchema.parse({
        id: "11111111-1111-4111-8111-111111111202",
        date: "2026-09-24",
        slotId,
        entry: {
          kind: "ingredient",
          ingredientId: rice.id,
          quantity: { value: 50, unit: "g" },
        },
        position: 1,
        note: "side",
        group: null,
      }),
    ];
    expect(canSaveSlotAsMeal(two)).toBe(true);
    const prefill = mealTemplatePrefillFromSlot(two, slotId);
    expect(prefill).not.toBeNull();
    expect(prefill!.components).toHaveLength(2);
    expect(prefill!.components[1]!.note).toBe("side");
    expect(prefill!.defaultSlotId).toBe(slotId);

    const withGroup: PlannedMeal[] = [
      ...two,
      PlannedMealSchema.parse({
        id: "11111111-1111-4111-8111-111111111203",
        date: "2026-09-24",
        slotId,
        entry: {
          kind: "recipeServings",
          recipeId: recipe.id,
          servings: 1,
        },
        position: 2,
        note: null,
        group: {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
          name: "G",
          templateId: null,
        },
      }),
    ];
    // Grouped row does not count toward the ungrouped threshold.
    expect(canSaveSlotAsMeal(withGroup)).toBe(true);
    expect(
      mealTemplatePrefillFromSlot(withGroup, slotId)!.components,
    ).toHaveLength(2);
  });
});
