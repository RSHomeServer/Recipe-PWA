# Domain Model

Authoritative entity model for Recipe PWA. Every rule here traces to an agreed decision —
see the [decision map](#v1-decision-map). Nothing in this document is provisional. Companions:
[UNIT_MODEL.md](./UNIT_MODEL.md) (quantities),
[NUTRITION_MODEL.md](./NUTRITION_MODEL.md) (calculation and attribution),
[ARCHITECTURE.md](./ARCHITECTURE.md) (where the code lives and how it is tested),
[OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md) (the decision log — no blocking questions remain).

> **V2 additions.** Three sections below carry V2 changes, each marked and traced to an ADR in
> [`docs/adr`](../adr/README.md): `Ingredient` gains provenance and an optional photo
> ([ADR-002](../adr/002-reference-ingredient-data-and-provenance.md)), `PlannedMeal` and
> `LoggedMeal` gain a display-only `group`, and `MealTemplate` is a new entity
> ([ADR-004](../adr/004-meal-templates-by-expansion.md)). Everything else is unchanged, and
> **no V1 invariant is reversed**. The build specification is [V2_SCOPE.md](./V2_SCOPE.md).

TypeScript shapes are the intended contract, not final code. Zod schemas are the single
source of truth at implementation time, with types inferred from them.

## The five distinctions that must never blur

| Concept | Question it answers | Tense | Nutrition source |
| --- | --- | --- | --- |
| **Recipe** | How do I make this? | Timeless definition | Derived from its ingredients |
| **Batch** | What did I actually cook, and when? | Past event | **Frozen snapshot, captured at cook time** |
| **Portion** | How much of a batch is one helping? | Derived quantity | `snapshot total ÷ nominal portions` |
| **Planned meal** | What do I intend to eat? | Future intent | Derived; never authoritative |
| **Logged meal** | What did I actually eat? | Past fact | Derived from the entry it references |

Consequences that hold everywhere:

- A Planned meal is not a Logged meal. Logging *copies* intent into fact and links back; it
  never mutates or consumes the plan (decision 15).
- Portions exist only in relation to a Batch. There is no free-floating portion entity.
- **Pantry holds raw ingredients. Batches hold prepared food. These are two separate stock
  systems and are never merged** (decision 13).
- Creating a plan changes nothing physical. Cooking a Batch consumes pantry stock. Eating a
  portion consumes batch portions, never pantry stock (decisions 12–13).
- Nutrition is stored in exactly three places: on an `Ingredient`, in a `Batch.snapshot`, and
  on a `customFood` log entry. The first is reference data, the other two are **historical
  provenance**. Everywhere else — recipe totals, plan requirements, shopping, insights —
  nutrition is computed (decision 23).

## Entity map

```
Ingredient ──< RecipeLine >── Recipe ──< Batch (+ frozen snapshot) ──< portions
    │                            │                                      │
    ├──> PantryStock (quantity)  │                                      │
    │                            │                                      │
    └────────────┬───────────────┴──────────────────────────────────────┘
                 │                        │
            PlannedMeal              LoggedMeal ──> Contribution[] (derived)
                 │                        │                │
                 ▼                        ▼                ▼
            Shopping                  (facts)          Insights
         (derived + overlay)                        (derived views)
```

Stored: `Ingredient`, `IngredientCategory`, `Recipe`, `RecipeImage`, `Batch`, `PantryStock`,
`MealSlot`, `PlannedMeal`, `LoggedMeal`, `ShoppingOverlay`, `Settings`, and in V2
`MealTemplate`.

Derived, never persisted: recipe nutrition, availability, plan requirements, shopping
requirements, portions remaining, contributions, all insights (decisions 22–23).

## Shared value objects

```ts
type Id = string;                     // crypto.randomUUID()
type IsoDate = string;                // "2026-08-24" — local calendar day
type IsoDateTime = string;

type MeasureKind = "mass" | "volume" | "count";

/** As the user entered it. See UNIT_MODEL.md. */
type Quantity = { value: number; unit: Unit };          // { value: 1.2, unit: "kg" }

/** Normalised to the ingredient's canonical unit: g, ml, or item. This is what is stored. */
type CanonicalQuantity = { amount: number; kind: MeasureKind };

/** Extensible nutrient record. V1 populates the first four (decisions 1, 21). */
type Nutrition = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  // V2 additions slot in here without reshaping anything:
  // fibreG?, sugarG?, saturatedFatG?, sodiumMg?
};
```

`MealEntry` is the one shape shared by planning and logging. Reusing it is what makes "log
the planned meal" a one-line operation and guarantees plan and log are nutritionally
comparable.

```ts
type MealEntry =
  | { kind: "recipeServings"; recipeId: Id; servings: number }
  | { kind: "batchPortions";  batchId: Id;  portions: number }
  | { kind: "ingredient";     ingredientId: Id; quantity: Quantity }
  | { kind: "customFood";     food: CustomFood };        // log only
```

`customFood` is the only entry carrying its own nutrition. It exists so that eating out does
not force a fake recipe (decisions 16–17), and it is **not attributable to any ingredient** —
Insights reports it in an explicit unattributed bucket rather than hiding it. It is rejected
on a `PlannedMeal`.

## Ingredient

The unit of nutrition truth and the unit of pantry stock (decision 1).

```ts
type Ingredient = {
  id: Id;
  name: string;
  categoryId: Id | null;
  measureKind: MeasureKind;      // canonical unit: g, ml, or item (decision 2)
  nutrition: Nutrition;          // per 100 g / 100 ml / 1 item (decision 3)
  notes: string | null;
  archivedAt: IsoDateTime | null;

  // V2 — ADR-002
  source: IngredientSource;      // never null; where these figures came from
  imageId: Id | null;            // optional user photo; category icon when absent
};

type IngredientCategory = {
  id: Id;
  name: string;
  sortOrder: number;
  icon: string;                  // V2 — Lucide icon name; the default visual identity
  accent: string;                // V2 — token name, for category-coded chips
};
```

### V2 — provenance ([ADR-002](../adr/002-reference-ingredient-data-and-provenance.md))

```ts
type IngredientSource = {
  kind: "reference" | "packaging" | "userEntered" | "estimated";
  datasetId:   string | null;    // "cofid-2021"
  datasetName: string | null;    // full citation, rendered verbatim
  entryCode:   string | null;    // the source's own identifier
  entryName:   string | null;    // the name in the source, verbatim
  licence:     string | null;
  url:         string | null;    // where a human can check
  retrievedAt: IsoDate | null;
  note:        string | null;
};
```

Three invariants, added to the list below:

6. **`source` is metadata only.** No calculation, derivation, filter or sort may read it.
   Every nutrition path behaves identically for every `kind`. Guarded by property test.
7. **The origin fields are write-once**, in the same spirit as `BatchSnapshot`. Once an
   ingredient arrives from a dataset, that is permanent history.
8. **Editing the nutrition of a `reference` ingredient flips `kind` to `"userEntered"`** and
   preserves the origin fields, so the product can say "originally CoFID 17-123, since edited
   by you". Keeping the reference badge on an edited number is the one dishonest state this
   field could reach.

**Invariants**

1. `measureKind` is immutable once the ingredient is referenced by any recipe, pantry row,
   plan or log. Changing it would silently reinterpret stored quantities.
2. Nutrition values are `>= 0`. Zero-calorie ingredients are legal and common.
3. The nutrition basis is fixed by `measureKind` — 100 g, 100 ml, or 1 item. There is no
   per-ingredient reference-amount field; that fixed basis keeps every calculation one
   multiplication and matches how UK/EU labels are printed.
4. Ingredients are **archived, never deleted** — logs and recipes reference them. Archived
   ingredients are hidden from pickers but still resolve in history.
5. Categories are user-managed, with a small starter set seeded on first run. They group the
   pantry and order the shopping list; they carry no behaviour.

**Not in V1:** density and per-item weight (no cross-kind conversion — decision 2, see
[UNIT_MODEL.md](./UNIT_MODEL.md)); a staple/pantry-basic flag (deferred, see Availability
below); external-database provenance (decision 24, but the shape is ready for it — adding a
`source` field changes no calculation).

**Resolved in V2:** provenance arrived exactly as predicted — a `source` field, changing no
calculation. Density, per-item weight and the staple flag remain deferred.

## Recipe

A reusable definition (decision 4). It stores no nutrition.

```ts
type Recipe = {
  id: Id;
  name: string;
  servings: number;               // base/default serving count, > 0 (decision 5)
  lines: RecipeLine[];
  steps: string[];                // ordered preparation instructions
  tags: string[];
  imageId: Id | null;             // optional image (decision 4)
  notes: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  archivedAt: IsoDateTime | null;
};

type RecipeLine = {
  id: Id;
  ingredientId: Id;               // always an Ingredient — never another Recipe (decision 4)
  quantity: CanonicalQuantity;    // stored canonical
  displayUnit: Unit;              // what the user typed, e.g. "kg" — display only
  optional: boolean;              // excluded from totals, availability and shopping
  note: string | null;            // "finely diced"
};

type RecipeImage = { id: Id; blob: Blob; width: number; height: number };
```

**Invariants**

1. `servings > 0`. Per-serving nutrition is `total ÷ servings`; division by zero is
   unrepresentable.
2. A recipe never stores calories or macros (decisions 3, 6, 23).
3. `quantity.kind` equals the referenced ingredient's `measureKind`. Conversion happens at
   entry, not at read.
4. At most one line per ingredient — merge on entry, so requirement aggregation and
   availability stay trivial.
5. **No recipe nesting.** A `RecipeLine` references an `Ingredient` only. A recipe containing
   a sauce lists the sauce's ingredients directly (decision 4).
6. Recipes are archived, never deleted — batches and logs reference them.
7. Images are optional and user-supplied. **No layout may depend on one**
   ([DESIGN.md](./DESIGN.md)); a recipe without an image must look deliberate, not broken.

### Scaling

```ts
scaledLines(recipe, servings) = recipe.lines.map(l => ({
  ...l,
  quantity: { ...l.quantity, amount: l.quantity.amount * (servings / recipe.servings) },
}))
```

Strictly linear, computed dynamically, never stored as a separate recipe (decision 5). Used
by plan requirements, batch creation, and `recipeServings` entries.

## Batch

A specific instance of a recipe that was actually prepared (decision 7). This is the entity
the reference products lack, and what makes meal prep tractable.

```ts
type Batch = {
  id: Id;
  recipeId: Id;                  // source recipe — provenance and navigation
  scale: number;                 // what the user chose: 2 = "2× recipe" (decision 7)
  portionsNominal: number;       // portions this batch was divided into, > 0 (decision 7)
  cookedAt: IsoDateTime;
  label: string | null;          // "Sunday curry"
  closedAt: IsoDateTime | null;  // manual write-off of the remainder — see below
  notes: string | null;
  snapshot: BatchSnapshot;       // immutable; the nutritional truth for this batch
};
```

Deliberately **not** recorded (decisions 7, 24): cooked weight, containers, container
locations, freezing state, lots, or preparation metadata.

### The snapshot — frozen at cook time

**A Batch is a historical event, so its nutrition never changes.** Editing a recipe or
correcting an ingredient's nutrition afterwards must not alter what a batch cooked in March
reports, because past Meal Log figures and past Insights are derived from it.

```ts
type BatchSnapshot = {
  recipeName: string;                  // as it was called when cooked
  lines: BatchSnapshotLine[];
  total: Nutrition;                    // Σ lines[].nutrition
};

type BatchSnapshotLine = {
  ingredientId: Id;                    // for attribution and navigation
  ingredientName: string;              // as it was called when cooked
  quantity: CanonicalQuantity;         // what was ACTUALLY used, not what the recipe says
  nutrition: Nutrition;                // computed for that quantity, at cook time
};
```

**The snapshot records what was actually cooked**, not what the recipe specifies. Quantities
are seeded from `scaledLines(recipe, recipe.servings × scale)` and are then **editable in the
cook flow**: a recipe calling for 500 g of chicken cooked with 550 g stores 550 g. This is the
capability a bare scale factor cannot express, and it is why the snapshot carries lines rather
than only a total.

`ingredientId` is retained so attribution still groups a batch's calories under the same
ingredient as everything else; `ingredientName` is retained so a snapshot remains readable if
that ingredient is later renamed or archived.

**This is not the duplication decision 23 warns against.** That rule targets *analytical* data
— recipe totals, plan requirements, shopping arithmetic, insights — all of which remain
derived. A snapshot is historical provenance, which is not recomputable from anything else once
the recipe moves on.

**Invariants**

1. `scale > 0` and `portionsNominal > 0`.
2. **The snapshot is written once, at creation, and is never updated.** No migration, no
   repair job and no recipe edit may rewrite it. Repository writes must reject a mutation to
   `snapshot` on an existing batch.
3. **`snapshot` is authoritative for nutrition; `recipeId` and `scale` are provenance.** Every
   nutrition and attribution path reads the snapshot. Nothing recomputes a batch from the live
   recipe — that is the whole point.
4. Because quantities are editable, `snapshot.lines` may differ from
   `scaledLines(recipe, …)`. That divergence is expected and is not an error.
5. Creating a batch **deducts the snapshot's actual quantities from the pantry** (decision 12)
   — the amounts genuinely used, not the recipe's nominal amounts. Insufficient stock **warns
   but never blocks**: the user may adjust the pantry or cook anyway, and stock is allowed to
   reach zero or go negative rather than the action being refused.
6. Eating a portion **never** touches the pantry (decision 13).
7. `recipeId` may point at an archived recipe; the snapshot keeps the batch fully readable
   regardless.

### Portion — a derived quantity, not an entity

There is no `Portion` table. A portion is a reference plus a count:
`{ batchId, portions }`, expressed by the `batchPortions` variant of `MealEntry`.

```ts
// Derived on demand — never stored (decisions 8, 23).
portionNutrition(batch)        = batch.snapshot.total / batch.portionsNominal
portionsConsumed(batch, logs)  = Σ entry.portions for logs referencing this batch
portionsRemaining(batch, logs) = batch.portionsNominal − portionsConsumed(batch, logs)
```

`portions` is a real number, so 0.5 and 1.5 portions need no special handling anywhere
(decision 8). An 8-portion batch after eating 0.5 shows 7.5 remaining.

**Invariants**

1. `portionsRemaining` is **derived from logged consumption**, not stored. A stored counter
   would be a second copy of state that drifts whenever a log is edited or deleted.
2. Logging more portions than remain is a validation warning, not a hard error — consistent
   with decision 12's tolerance for imperfect data. Remaining is clamped at zero for display,
   but the underlying discrepancy is surfaced.
3. **A batch is available prepared food while `closedAt === null` and
   `portionsRemaining > ε`.** Availability is that one predicate; there is no separate "empty
   batch" state.

### Closing a batch

`closedAt` ends a batch whose remaining portions are no longer available — you binned the last
one, or gave it away.

Closing a batch: sets `closedAt`; removes it from available prepared food; **writes off** the
remaining portions; creates **no waste record** (decision 24 excludes food-waste tracking); and
**never alters historical nutrition** — the snapshot and every log against it are untouched, so
past Insights do not move.

A batch reaching zero portions is closed in exactly the sense that matters: it leaves available
prepared food, with no separate "empty batch" state — which is the required behaviour, since
availability is the single predicate in invariant 3.

**Implementation note.** `closedAt` is written **only for manual closure**; exhaustion is
handled by the predicate rather than by writing a timestamp. Writing `closedAt` when portions
hit zero would store a value fully determined by `portionsRemaining`, and because remaining is
derived, deleting or reducing a log would then leave a batch marked closed while it again has
food in it — requiring a second field to record whether closure was the user's decision or
arithmetic. Deriving exhaustion avoids that entirely and produces identical behaviour on
screen. If a stored `closedAt` on exhaustion is wanted for reporting, it must be paired with a
`closedManually` flag so the two cases stay distinguishable.

## Pantry

Current quantities of **raw ingredients** available for cooking (decision 9). Deliberately a
practical planning aid, not an accounting system (decision 10).

```ts
type PantryStock = {
  ingredientId: Id;              // primary key — one row per ingredient
  quantity: CanonicalQuantity;   // current amount, in the ingredient's canonical unit
  updatedAt: IsoDateTime;
};
```

Operations are `add`, `remove`, and `set` (adjust). Adding 1 kg of chicken to 500 g gives a
single row reading 1.5 kg; using 350 ml of a 2 L milk row leaves 1650 ml (decision 10).

**Invariants**

1. **One row per ingredient. No lots, no FIFO, no batch numbers, no expiry, no packaging, no
   supermarket product identity** (decision 10).
2. Pantry stock references `Ingredient`. There is no separate "pantry ingredient" concept
   (decision 9).
3. `quantity.kind` equals the ingredient's `measureKind`.
4. Quantity **may go negative**, and negative values are **never clamped and never block an
   operation**. A negative row means records and reality disagree — usually because something
   was cooked from stock that was never recorded. Surface it clearly with a one-tap correction.
5. Stock leaves the pantry in exactly two situations:
   - a **Batch is created** — the snapshot's actual quantities are deducted (decision 12);
   - a bare **`ingredient`** meal is logged — you ate the yoghurt or drank the milk raw. Log
     200 ml of milk against 1000 ml in stock and the row reads 800 ml.

   Stock never leaves because a **portion** was eaten (decision 13), never because a
   `recipeServings` meal was logged (only cooking consumes), and never because something was
   **planned** (decision 12).
6. A row whose quantity reaches zero is kept, not deleted. "Known but not stocked" is useful
   state for ingredient pickers and shopping workflows.

**Reversal note.** Earlier planning proposed an append-only movement ledger with the quantity
derived from it. Decision 10 — "the pantry is a practical planning aid, not an accounting
system", with waste tracking and lots explicitly excluded — settles this the other way. The
stored quantity is now the source of truth. The cost is that the pantry cannot explain its own
history; that is the accounting behaviour the decision rules out. Rationale and trade-off are
recorded in [ARCHITECTURE.md](./ARCHITECTURE.md).

### Availability — "what can I make?"

Derived per recipe by comparing scaled requirements against pantry quantities
(decisions 11, 23).

```ts
type Availability =
  | { status: "canMake";            shortfalls: [] }
  | { status: "almostCanMake";      shortfalls: Shortfall[] }
  | { status: "missingSignificant"; shortfalls: Shortfall[] };

type Shortfall = {
  ingredientId: Id;
  required:  CanonicalQuantity;
  available: CanonicalQuantity;
  short:     CanonicalQuantity;    // required − available
};
```

Rules: optional lines are ignored. A line is short when `required > available + ε`
([UNIT_MODEL.md](./UNIT_MODEL.md)). Classification is by **how many ingredients are short**:

```ts
/** UX classification, not a domain truth. Tune after usability testing. */
const ALMOST_CAN_MAKE_MAX_MISSING = 2;
```

None short → `canMake`; one or two → `almostCanMake`; three or more → `missingSignificant`.

The threshold lives in that one named constant so it can be tuned without touching any
calculation. **No staple or pantry-basic flag exists in V1**: a missing quantity of salt counts
as a shortfall exactly like a missing quantity of chicken. Adding such a flag later refines the
classification without changing the model.

The classification is always fully explained by `shortfalls`, which the UI must show —
"Missing: Onion 50g", matching decision 11's example. Availability is presentational
guidance, never a gate on any action (decision 11).

## Meal Plan

Intent (decision 14). A flat list of planned meals; there is no plan aggregate entity, because
a plan is just the planned meals in a date range.

```ts
type MealSlot = {              // data, not a hard-coded union (decision 14)
  id: Id;
  name: string;                // "Breakfast", "Lunch", "Dinner", "Snack"
  sortOrder: number;
  isDefault: boolean;
};

type PlannedMeal = {
  id: Id;
  date: IsoDate;
  slotId: Id;                  // references MealSlot
  entry: MealEntry;            // customFood is rejected here
  position: number;            // ordering within a slot (drag and drop)
  note: string | null;
  group: PlanGroup | null;     // V2 — ADR-004; display and bulk actions only
};
```

### V2 — meal groups ([ADR-004](../adr/004-meal-templates-by-expansion.md))

```ts
type PlanGroup = {
  id: Id;                // shared by every row applied together
  name: string;          // the template's name at the moment it was applied
  templateId: Id | null; // provenance; may dangle
};
```

`LoggedMeal` carries the same nullable field, copied when logging from a grouped plan.
`name` is stored rather than resolved for the same reason as `BatchSnapshot.recipeName`: a
plan made in March must still read correctly after the template is renamed or deleted.

Added to the invariants below:

6. **No derivation may read `group`.** `requirements()`, `expand()`, shopping aggregation,
   availability, nutrition and every insight must produce byte-identical output whether
   `group` is populated or null. This is the property that makes meal templates incapable of
   breaking anything derived, and it is a test rather than a convention.
7. Grouped rows are **ordinary planned meals** — individually editable, movable and
   deletable. Deleting one leaves the others intact.
8. `group.id` carries no referential integrity. It is a correlation tag, not a foreign key.

**Invariants**

1. Slots are **records, not an enum**. V1 seeds Breakfast, Lunch, Dinner and Snack and the UI
   exposes only those, but nothing in the model or the layout assumes a fixed number of meals
   per day (decision 14). Adding custom slots later is a settings screen, not a migration.
2. The same recipe may appear any number of times, on any number of days (decision 14).
   Several planned meals may share a `(date, slotId)`; ordering is `position`.
3. A planned meal is never nutrition-of-record. Its nutrition is derived for display and for
   planned-versus-actual comparison only.
4. **Planning changes nothing physical** — no pantry deduction, no portion consumption
   (decision 12).
5. Deleting a planned meal never deletes a log that referenced it. The log keeps a dangling
   `plannedMealId`, which must resolve to null gracefully.

### Plan requirements

```ts
requirements(dateRange) = aggregate over planned meals:
  recipeServings  → for each non-optional line: quantity × (servings ÷ recipe.servings)
  batchPortions   → CONTRIBUTES NOTHING — the food already exists
  ingredient      → that quantity
  → grouped by ingredientId, summed in canonical units
```

Repeated recipes aggregate naturally: Chicken Curry planned on Monday, Tuesday and Wednesday
contributes three times before pantry stock is subtracted (decisions 14, 18).

The `batchPortions` rule is the crux of the meal-prep loop: planning to eat Sunday's curry on
Wednesday must not put chicken back on the shopping list.

## Meal Template (V2)

A saved combination you eat often — "chicken thighs + hashbrowns + peas + BBQ sauce". Called
a **Meal** in the UI ([ADR-003](../adr/003-food-nomenclature-and-promotion-rule.md) §4).

```ts
type MealTemplate = {
  id: Id;
  name: string;
  components: MealTemplateComponent[];
  defaultSlotId: Id | null;         // usually Dinner; null means "ask"
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  archivedAt: IsoDateTime | null;
};

type MealTemplateComponent = {
  id: Id;
  entry: RecipeServingsEntry | IngredientEntry;   // no batchPortions, no customFood
  note: string | null;
};
```

**A template expands; it does not nest.** Applying one to a day and slot creates one ordinary
`PlannedMeal` per component, sharing a `PlanGroup`. There is no `{ kind: "meal" }` variant of
`MealEntry`, because adding one would put a new branch in every derivation — recipe nesting
arriving through a different door, and a reversal of decision 4. Expansion gets the same
result with no derived path changed at all. The reasoning, and the two options rejected, are
in [ADR-004](../adr/004-meal-templates-by-expansion.md).

**Invariants**

1. A component's entry is `recipeServings` or `ingredient` only. **A template may not
   reference a batch**: a template is timeless, a batch is a specific past event with a finite
   number of portions, so the reference would break the moment that batch is eaten. Eating a
   portion is already a one-tap action and needs no saved shape.
2. Templates are archived, never deleted — `PlanGroup.templateId` points at them.
3. **Editing a template never rewrites plans already made from it.** Intent already expressed
   is a record, consistent with decisions 15 and A.
4. A template stores no nutrition and no requirements. Both are derived from the expanded
   rows, exactly as for any other planned meal.

## Meal Log

What was actually consumed (decision 15).

```ts
type LoggedMeal = {
  id: Id;
  date: IsoDate;
  slotId: Id;
  entry: MealEntry;             // all four kinds allowed
  plannedMealId: Id | null;     // provenance when logged from the plan
  loggedAt: IsoDateTime;
  note: string | null;
};

type CustomFood = {            // decision 17 — inline on the log, not a reusable entity in V1
  name: string;
  quantity: number;            // multiplier applied to the figures below; default 1
  nutrition: Nutrition;        // as entered by the user
};
```

**Invariants**

1. Logging from a plan **copies** `entry` and sets `plannedMealId`. The `PlannedMeal` is not
   modified or deleted. Planning 1 portion and logging 1.5 is normal: the plan still reads 1,
   the log reads 1.5 (decision 15).
2. A planned meal may have zero, one or several logs. A log may have no plan (decision 16).
3. What logging consumes:
   - `batchPortions` → reduces that batch's derived `portionsRemaining`. **Never touches the
     pantry** (decision 13).
   - `ingredient` → **deducts from `PantryStock`**, because raw stock genuinely left the
     pantry. Never blocked: if the recorded quantity is insufficient the row goes negative and
     is surfaced for correction, never clamped.
   - `recipeServings` → deducts nothing. Only creating a Batch consumes pantry stock
     (decision 12). This entry means "I ate this recipe but did not track cooking it".
   - `customFood` → touches nothing but the log.
4. Logging must be fast for the common case of an existing recipe (decision 16), and must
   support recipes, ingredients, batch portions and custom foods (decisions 8, 16, 17).
5. Logs are editable and deletable. Deleting one restores whatever it consumed: portions come
   back because they are derived; a pantry deduction is reversed explicitly on delete.
6. `loggedAt` is recorded on every log, but **time is not surfaced as significant UI in V1** —
   the day and slot are what the product reasons about. Storing it now means per-entry
   timestamps become a presentation change later rather than a migration.

## Shopping

Not an entity. The list is a derived view plus a thin overlay of user state
(decisions 18–19).

```ts
type ShoppingLine = {                 // fully derived
  ingredientId: Id;
  required:  CanonicalQuantity;       // aggregated plan requirements
  inPantry:  CanonicalQuantity;
  toBuy:     CanonicalQuantity;       // max(0, required − inPantry)
  sources: { recipeId: Id | null; date: IsoDate; amount: CanonicalQuantity }[];
};

type ShoppingOverlay = {              // the only stored part
  id: Id;
  windowKey: string;                          // `${from}_${to}` — the exact range it belongs to
  checked: Id[];                              // ingredient ids ticked off
  suppressed: Id[];                           // "I don't need this after all"
  adjustments: { ingredientId: Id; quantity: CanonicalQuantity }[];   // decision 19
  manual: { id: Id; ingredientId: Id; quantity: CanonicalQuantity }[];
};
```

```ts
shoppingList(range) = requirements(range) − pantry(), lines where toBuy > ε,
                      plus overlay.manual, minus overlay.suppressed,
                      with overlay.adjustments applied for display
```

### The shopping window

**A user-chosen date range, defaulting to today → today + 6 days** (seven days inclusive).
The range is shown and editable at the top of the shopping view. It is **not** a calendar week
and is **never unbounded**.

```ts
type ShoppingWindow = { from: IsoDate; to: IsoDate };
const windowKey = (w: ShoppingWindow) => `${w.from}_${w.to}`;
```

`windowKey` is part of the overlay's identity, so **ticks are never silently reinterpreted as
belonging to a different range**. Changing the range loads that range's own overlay, which is
usually empty; the previous overlay is untouched and is still there if the user changes back.
When the user narrows or shifts a range that has ticks, offer an explicit "carry over ticked
items" action rather than either discarding them or migrating them silently.

**Invariants**

1. The computed list is **never persisted**, and a manually entered list is never the source
   of truth (decision 18). Change the plan or the pantry and the list differs immediately.
2. Requirements are aggregated across **all planned meals in the selected range**, and pantry
   stock is subtracted **after** aggregation (decision 18) — never per meal, which would
   under-subtract when a recipe is planned several times.
3. **A user adjustment stays distinguishable from the derived requirement** (decision 19).
   `adjustments` overrides the displayed buy quantity while `toBuy` remains visible as the
   calculated figure — "we worked out 1.3 kg, you're buying 1.5 kg". The adjustment never
   rewrites the derivation. No packaging or price logic (decisions 19, 24).
4. Ticking a line adds the bought amount to `PantryStock` and records the tick. This is how
   the pantry stays roughly accurate without deliberate upkeep.
5. `sources` gives provenance ("why is 1.3 kg of chicken on my list?") and drives the
   group-by-recipe view. Computed during aggregation, not stored.
6. `toBuy` is floored at zero — surplus stock is not a negative shopping line.

## Settings

```ts
type Settings = {
  id: "singleton";
  dailyCalorieTarget: number | null;   // optional, manually entered (decision 20)
  weekStartsOn: 1;                     // Monday
  themePreference: "light" | "dark" | "system";
};
```

**Invariants**

1. The calorie target is **optional and manually entered**. No BMR, TDEE, activity
   multipliers, weight-loss goals or projections (decision 20).
2. Target is presentational only — it never affects a calculation, and the absence of a target
   must not degrade any view. Insights works fully without one.
3. Macro targets are a later addition: extra nullable fields here, no calculation change
   (decision 20).

## Insights

Entirely derived from Meal Logs (decisions 22–23). No insights entity, no rollup table, no
scheduled aggregation.

Every insight is a fold over one primitive — the ingredient-level `Contribution`, defined in
[NUTRITION_MODEL.md](./NUTRITION_MODEL.md):

```ts
type Contribution = {
  ingredientId: Id | null;      // null = customFood, unattributable
  ingredientName: string;
  quantity: CanonicalQuantity | null;
  nutrition: Nutrition;
  source: { logId: Id; date: IsoDate; slotId: Id; recipeId: Id | null; batchId: Id | null };
};
```

Calories by day, by meal, by recipe and by ingredient, plus per-recipe attribution, are all
`groupBy` + `sum` over `Contribution[]` (decision 22). One tested expansion function, then
trivial folds — which is why the calculation core is testable without any UI.

**Invariant:** every insight over a period must reconcile —
`Σ by-meal = Σ by-recipe = Σ by-ingredient (+ unattributed) = Σ by-day`. The single most
valuable property test in the codebase.

## V1 decision map

Where each agreed decision landed, so later tickets can trace a rule to its source.

| Decision | Where it lives |
| --- | --- |
| 1 Ingredients, extensible nutrients | `Ingredient`, `Nutrition` |
| 2 Three unit families, canonical units, no arbitrary conversions | [UNIT_MODEL.md](./UNIT_MODEL.md) |
| 3 Nutrition bases, precision, round at display | [NUTRITION_MODEL.md](./NUTRITION_MODEL.md) |
| 4 Recipe contents, optional image, no nesting | `Recipe`, `RecipeLine`, `RecipeImage` |
| 5 Linear dynamic scaling | `scaledLines` |
| 6 Derived recipe nutrition + ingredient attribution | [NUTRITION_MODEL.md](./NUTRITION_MODEL.md) |
| 7 Batch fields; no cooked weight or containers | `Batch` |
| 8 Fractional portions, remaining tracked | Portion (derived) |
| 9 Pantry references ingredients | `PantryStock` |
| 10 Pantry stays simple; quantities merge | `PantryStock` invariants |
| 11 What can I make? three states | `Availability` |
| 12 Cooking consumes; warn, never block | `Batch` invariant 5 |
| 13 Pantry raw vs batches cooked | `LoggedMeal` invariant 3 |
| 14 Plan is intent; extensible slots | `MealSlot`, `PlannedMeal` |
| 15 Log is fact; plan unchanged | `LoggedMeal` invariant 1 |
| 16 Fast logging of recipe / ingredient / custom | `MealEntry`, `LoggedMeal` |
| 17 Custom food | `CustomFood` |
| 18 Shopping derived, aggregate then subtract | `ShoppingLine` invariant 2 |
| 19 Adjustable but distinguishable | `ShoppingOverlay.adjustments` |
| 20 Optional manual calorie target | `Settings` |
| 21 Core metrics, daily and weekly | [NUTRITION_MODEL.md](./NUTRITION_MODEL.md) |
| 22 Insight views | `Contribution` folds |
| 23 Derive, don't duplicate; testable | Derived list above; [ARCHITECTURE.md](./ARCHITECTURE.md) |
| 24 Out of scope | "Not modelled" below |
| A Freeze batch nutrition at cook time | `BatchSnapshot` |
| B Logging a bare ingredient deducts stock | `PantryStock` invariant 5, `LoggedMeal` invariant 3 |
| C `closedAt` write-off, auto at zero | Closing a batch |
| D Shopping window: user range, default 7 days | The shopping window |
| E JSON export/import with base64 images | [ARCHITECTURE.md](./ARCHITECTURE.md) |

## V2 decision map

| ADR | Where it lands in this document |
| --- | --- |
| [001](../adr/001-page-geometry-and-density.md) Page geometry and density | Nothing here — presentation only, see [DESIGN.md](./DESIGN.md) §5 |
| [002](../adr/002-reference-ingredient-data-and-provenance.md) Reference data and provenance | `Ingredient.source`, `Ingredient.imageId`, `IngredientCategory.icon`/`accent` |
| [003](../adr/003-food-nomenclature-and-promotion-rule.md) Nomenclature and the promotion rule | Nothing here — the entities were already right; the words were not |
| [004](../adr/004-meal-templates-by-expansion.md) Meal templates by expansion | `MealTemplate`, `PlanGroup`, `PlannedMeal.group`, `LoggedMeal.group` |
| [005](../adr/005-choice-controls-by-cardinality.md) Choice controls by cardinality | `Settings.controlStyle` |

Note what is **not** in that table. Two of the five V2 decisions change no entity at all, and
the two that do add fields no calculation is permitted to read. That is the intended shape of
a V2 on a model that was designed correctly the first time.

## Deliberately not modelled in V1

Three entries below were revisited in V2 and are marked inline. Everything else stands.
Per decision 24 and the sections above: barcode scanning · external food databases ·
automatic calorie-target calculation (BMR/TDEE/activity) · expiry dates · stock lots and FIFO
· food-waste tracking as a quantity · packaging, pricing and supermarket product identity ·
recipe importing from websites · AI recipe or meal generation · multi-user accounts · social
features · cloud sync · merge-based import · cooked-weight tracking · container tracking and
locations · recipe-to-recipe nesting · micronutrients beyond the initial four ·
per-ingredient staple flags · recipe nutrition versioning · reusable custom-food entities.

Each has a clear later home: `Ingredient` and `Nutrition` gain fields, `Batch` gains container
rows, `Settings` gains macro targets, `CustomFood` becomes a stored entity, `MealSlot` is
already data. None requires reshaping the five core distinctions, which is the point of keeping
the model this
small.

**Revisited in V2:**

- *External food databases* — now in scope as a **one-time seeded import** with per-ingredient
  provenance ([ADR-002](../adr/002-reference-ingredient-data-and-provenance.md)). Live lookup
  and barcode scanning remain out.
- *Recipe-to-recipe nesting* — still out, and now with a stated alternative for the need it
  was standing in for ([ADR-004](../adr/004-meal-templates-by-expansion.md)).
- *Per-ingredient images* — now supported as an optional user photo, on exactly the same terms
  as recipe images: no layout may depend on one.

The prediction in the paragraph above held. Provenance was a field on `Ingredient`, and the
combined-meal requirement was met without touching a single one of the five core distinctions
— which is the evidence that the V1 model was the right size.
