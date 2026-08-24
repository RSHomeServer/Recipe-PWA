# Domain Model

Authoritative entity model for Recipe PWA. Companions:
[UNIT_MODEL.md](./UNIT_MODEL.md) (quantities and conversion),
[NUTRITION_MODEL.md](./NUTRITION_MODEL.md) (calculation and attribution),
[ARCHITECTURE.md](./ARCHITECTURE.md) (where this code lives and how it is tested).

TypeScript shapes below are the intended contract, not final code. Zod schemas are the
single source of truth at implementation time and types are inferred from them
(see ARCHITECTURE.md).

## The five distinctions that must never blur

This is the rule the rest of the document exists to protect.

| Concept | Question it answers | Tense | Nutrition source |
| --- | --- | --- | --- |
| **Recipe** | How do I make this? | Timeless definition | Derived live from current ingredients |
| **Batch** | What did I actually cook, and when? | Past event | Frozen snapshot taken at cook time |
| **Portion** | How much of a batch is one helping? | Derived quantity | `batch nutrition ÷ portion count` |
| **Planned meal** | What do I intend to eat? | Future intent | Derived; never authoritative |
| **Logged meal** | What did I actually eat? | Past fact | Derived from the entry it references |

Consequences that follow, and must hold everywhere:

- Editing a Recipe changes future cooking. It **never** changes a Batch already cooked, and
  therefore never changes history in the Meal Log or Insights.
- A Planned meal is not a Logged meal. Logging *copies* intent into fact and links back; it
  does not mutate or consume the plan.
- Portions exist only in relation to a Batch. There is no free-floating "portion" entity.
- Nutrition is stored in exactly two places: on an Ingredient, and inside a Batch snapshot.
  Everywhere else it is computed.

## Entity map

```
Ingredient ──< RecipeLine >── Recipe ──< Batch (snapshot) ──< portions
    │                            │                              │
    ├──< StockMovement (pantry ledger)                           │
    │                                                           │
    └────────────┬──────────────┬───────────────────────────────┘
                 │              │
            PlannedMeal    LoggedMeal ──> Contribution[] (derived)
                 │              │                │
                 ▼              ▼                ▼
            Shopping        (facts)          Insights
         (derived view)                    (derived views)
```

Stored entities: `Ingredient`, `Recipe`, `Batch`, `StockMovement`, `PlannedMeal`,
`LoggedMeal`, `ShoppingOverlay`.
Derived (never persisted): pantry quantities, recipe nutrition, availability, plan
requirements, the shopping list, contributions, all insights.

## Shared value objects

```ts
type Id = string;                     // crypto.randomUUID()
type IsoDate = string;                // "2026-08-24" — local calendar day
type IsoDateTime = string;            // "2026-08-24T18:30:00.000Z"

type MeasureKind = "mass" | "volume" | "count";

/** A quantity as the user entered it. See UNIT_MODEL.md. */
type Quantity = { value: number; unit: Unit };        // e.g. { value: 1.2, unit: "kg" }

/** A quantity normalised to the ingredient's canonical unit: g, ml, or item. */
type CanonicalQuantity = { amount: number; kind: MeasureKind };

/** kcal + the four initial macros in grams. See NUTRITION_MODEL.md. */
type Nutrition = { kcal: number; proteinG: number; carbsG: number; fatG: number };

type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";
```

`MealEntry` is the one shape that both planning and logging use. Reusing it is what keeps
"log the planned meal" a one-line operation and guarantees plan and log are nutritionally
comparable.

```ts
type MealEntry =
  | { kind: "recipeServings"; recipeId: Id; servings: number }   // intend/ate N servings
  | { kind: "batchPortions"; batchId: Id; portions: number }     // intend/ate N portions
  | { kind: "ingredient"; ingredientId: Id; quantity: Quantity } // plain food
  | { kind: "quickAdd"; nutrition: Nutrition; label: string };   // log only — see below
```

`quickAdd` is the only entry that carries its own nutrition. It exists so eating out does
not force a fake recipe, and it is **not attributable** to any ingredient — Insights must
report it as a distinct "unattributed" bucket rather than hiding it. It is rejected on a
`PlannedMeal`.

## Ingredient

A reusable food item: the unit of nutrition truth and the unit of pantry stock.

```ts
type Ingredient = {
  id: Id;
  name: string;
  categoryId: Id | null;         // grouping for pantry and shopping (aisle)
  measureKind: MeasureKind;      // canonical kind — g, ml, or item
  /** Nutrition per 100 g, per 100 ml, or per 1 item, per measureKind. */
  nutrition: Nutrition;
  /** Cross-kind conversion metadata. Absent = that conversion is unavailable. */
  densityGPerMl: number | null;  // mass ↔ volume
  gramsPerItem: number | null;   // count ↔ mass
  isStaple: boolean;             // salt, oil, spices — softens availability rules
  notes: string | null;
  archivedAt: IsoDateTime | null;
};
```

**Invariants**

1. `measureKind` is immutable once the ingredient is referenced by any recipe, movement,
   plan or log. Changing it would silently reinterpret stored quantities.
2. `nutrition` values are `>= 0`. A zero-calorie ingredient (water, most spices) is legal.
3. Nutrition is expressed against the reference quantity implied by `measureKind` — 100 g,
   100 ml, or 1 item. There is no per-ingredient "reference amount" field; that fixed basis
   is deliberate and keeps every calculation one multiplication.
4. Ingredients are **archived, never deleted**, because Batch snapshots, logs and movements
   reference them. Archived ingredients are hidden from pickers but resolve in history.
5. Renaming an ingredient is safe and retroactive. Changing its *nutrition* is not
   retroactive for cooked batches (frozen in the snapshot) but **is** retroactive for
   recipes and for logged `ingredient` entries — an accepted, documented trade-off
   (see [OPEN_QUESTIONS](./OPEN_QUESTIONS.md) Q1).

## Recipe

A definition. It stores no nutrition of any kind.

```ts
type Recipe = {
  id: Id;
  name: string;
  servings: number;               // yield, > 0
  lines: RecipeLine[];
  steps: string[];                // ordered preparation instructions
  tags: string[];
  cookedWeightG: number | null;   // optional; see NUTRITION_MODEL.md
  notes: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  archivedAt: IsoDateTime | null;
};

type RecipeLine = {
  id: Id;
  ingredientId: Id;
  quantity: CanonicalQuantity;    // stored canonical; entry unit kept for display only
  displayUnit: Unit;              // what the user typed in, e.g. "kg"
  optional: boolean;              // excluded from availability and shopping when true
  note: string | null;            // "finely diced"
};
```

**Invariants**

1. `servings > 0`. Per-serving nutrition is `total ÷ servings`; division by zero is
   unrepresentable.
2. A recipe never stores calories or macros. Any UI showing recipe nutrition computes it.
3. `quantity.kind` must equal the referenced ingredient's `measureKind`. Conversion happens
   at entry time, not at read time (UNIT_MODEL.md).
4. At most one line per ingredient. Merge on entry rather than allowing duplicates, so
   requirement aggregation and availability stay trivial.
5. Recipes are archived, never deleted — Batches reference them.
6. A recipe with zero lines is valid (a stub being drafted) but yields zero nutrition and
   is always "makeable". UI should treat empty recipes as drafts.

## Batch

A specific instance of a recipe that was actually prepared. This is the entity the
reference products lack, and it is what makes meal prep tractable.

```ts
type Batch = {
  id: Id;
  recipeId: Id;                   // provenance only — never read for nutrition
  cookedAt: IsoDateTime;
  label: string | null;           // "Sunday curry"
  portionsTotal: number;          // > 0, how many helpings this batch was divided into
  snapshot: BatchSnapshot;        // immutable
  notes: string | null;
};

/** Frozen copy of what actually went in, taken at cook time. */
type BatchSnapshot = {
  recipeName: string;
  lines: {
    ingredientId: Id;
    ingredientName: string;                // denormalised for durable display
    quantity: CanonicalQuantity;           // actual amount used, may differ from the recipe
    nutrition: Nutrition;                  // contribution of this line to the whole batch
  }[];
  total: Nutrition;                        // Σ line nutrition
};
```

**Invariants**

1. `snapshot` is **immutable** after creation. This is the mechanism that stops recipe or
   ingredient edits rewriting history.
2. `snapshot.total` equals the sum of `snapshot.lines[].nutrition` within floating-point
   tolerance. It is stored for convenience and must be recomputable from the lines — a
   property worth asserting in tests.
3. `portionsTotal > 0`. Portion nutrition is `snapshot.total ÷ portionsTotal`.
4. Cooking a batch may deduct pantry stock, which is recorded as `StockMovement` rows with
   `reason: "cooked"` and `refId: batch.id` — never by mutating a stored quantity.
5. Actual quantities used may be edited **at cook time** (you used 550 g not 500 g); once
   the batch is created the snapshot is closed. Correcting a mistake means voiding the batch
   and re-creating it, not editing it.
6. `recipeId` may point at an archived recipe. The snapshot is self-sufficient for display.

### Portion — a derived quantity, not an entity

There is no `Portion` table. A portion is a reference plus a count:
`{ batchId, portions: number }`, expressed by the `batchPortions` variant of `MealEntry`.

```ts
// Derived, computed on demand — never stored.
portionNutrition(batch)          = batch.snapshot.total / batch.portionsTotal
portionsConsumed(batch, logs)    = Σ logs where entry.batchId === batch.id
portionsDiscarded(batch, moves)  = Σ discard records for that batch
portionsRemaining(batch, …)      = batch.portionsTotal − consumed − discarded
```

`portions` is a real number, so 0.5 and 1.5 portions are natural. Physical containers are
deliberately not modelled; portion count carries the information without inventing an
entity per plastic tub ([OPEN_QUESTIONS](./OPEN_QUESTIONS.md) Q2).

**Invariant:** `portionsRemaining >= 0`. Logging more portions than remain is a validation
error the UI must surface, not silently allow, otherwise remaining counts go negative and
availability lies.

## Pantry

Current stock of ingredients. The pantry is a **ledger**, and current quantity is a
projection of it. This follows the brief's "prefer deterministic calculation over
duplicated state" rule literally: there is no stored quantity that can drift out of step
with its history.

```ts
type StockMovement = {
  id: Id;
  ingredientId: Id;
  delta: CanonicalQuantity;      // signed: +250 g bought, −500 g cooked
  reason: StockReason;
  refId: Id | null;              // batch id, shopping line id, log id
  at: IsoDateTime;
  note: string | null;
};

type StockReason =
  | "purchase"      // shopping item ticked off, or manual restock
  | "cooked"        // consumed by a Batch
  | "eaten"         // logged directly as an `ingredient` meal entry
  | "waste"         // spoiled, thrown away
  | "correction";   // stock-take: user says the real number is X
```

```ts
// Derived views — the whole of "the pantry".
pantryQuantity(ingredientId) = Σ movements.delta for that ingredient
pantry()                     = every ingredient with a non-zero derived quantity
```

**Invariants**

1. Movements are **append-only**. A mistake is corrected by another movement
   (`correction`), never by editing or deleting history. This is what makes "where did my
   stock go?" answerable.
2. `delta.kind` must equal the ingredient's `measureKind`.
3. Derived quantities **may go negative** — that means reality and records disagree (you
   cooked with something you never recorded buying). Do not clamp it: surface it, and offer
   a one-tap `correction`. Silently clamping hides the only signal that the pantry is wrong.
4. A `correction` movement is written as the delta needed to reach the stated quantity, so
   the ledger stays purely additive.
5. Ledger size is a non-issue at personal scale. If it ever is, the mitigation is a periodic
   `opening balance` movement that supersedes older rows — not a stored quantity field.

### Availability — "what can I make?"

Derived per recipe, from pantry quantities. Three states, matching the brief and SuperCook's
useful trichotomy:

```ts
type Availability =
  | { status: "canMake" }
  | { status: "missingMinor"; shortfalls: Shortfall[] }  // only staples short
  | { status: "missingMajor"; shortfalls: Shortfall[] }; // ≥1 non-staple short

type Shortfall = {
  ingredientId: Id;
  required: CanonicalQuantity;
  available: CanonicalQuantity;
  short: CanonicalQuantity;
};
```

Rules: optional lines are ignored. A line is short when
`required > available + ε` (tolerance per UNIT_MODEL.md). Classification is `canMake` when
there are no shortfalls, `missingMinor` when every short ingredient has `isStaple: true`,
otherwise `missingMajor`. There is no heuristic scoring — the classification is fully
explained by the shortfall list, which the UI should show.

## Meal Plan

Intent. A flat list of planned meals; there is no "Plan" aggregate entity, because a plan is
just the planned meals inside a date range.

```ts
type PlannedMeal = {
  id: Id;
  date: IsoDate;
  slot: MealSlot;
  entry: MealEntry;              // quickAdd is rejected here
  position: number;              // ordering within a slot (drag and drop)
  note: string | null;
};
```

**Invariants**

1. Several planned meals may share a `(date, slot)`. Ordering is `position`.
2. A planned meal is never nutrition-of-record. Its nutrition is derived for display and for
   "planned vs actual" only.
3. Planning does **not** touch the pantry and does **not** consume batch portions. Only
   cooking and logging move stock.
4. Deleting a planned meal never deletes a log that referenced it. The log keeps a dangling
   `plannedMealId` which must be tolerated (nullable resolution).

### Plan requirements

```ts
requirements(dateRange) = aggregate over planned meals:
  recipeServings  → for each non-optional line: quantity × (servings ÷ recipe.servings)
  batchPortions   → CONTRIBUTES NOTHING — the food already exists
  ingredient      → that quantity
  → grouped by ingredientId, summed in canonical units
```

The `batchPortions` rule is the crux of the meal-prep loop: planning to eat Sunday's curry
on Wednesday must not put chicken back on the shopping list.

## Meal Log

Fact. What was actually eaten.

```ts
type LoggedMeal = {
  id: Id;
  date: IsoDate;
  slot: MealSlot;
  entry: MealEntry;              // all four kinds allowed
  plannedMealId: Id | null;      // provenance when logged from the plan
  loggedAt: IsoDateTime;         // when the record was created, not when eaten
  note: string | null;
};
```

**Invariants**

1. Logging from a plan **copies** `entry` and sets `plannedMealId`. The `PlannedMeal` is not
   modified or deleted. You can log 0.5 portions against a plan for 1 — the discrepancy is
   data, not an error.
2. A planned meal may have zero, one, or several logs. A log may have no plan.
3. Logging is what consumes reality:
   - `batchPortions` → reduces that batch's derived `portionsRemaining`
   - `ingredient` → writes a `StockMovement` with `reason: "eaten"`
   - `recipeServings` → **does not** deduct pantry stock. Cooking already did, via the
     Batch. "I cooked and ate it immediately" is expected to go through a one-portion Batch
     so there is a single deduction path, leaving a bare `recipeServings` log to mean "I ate
     this recipe but did not track cooking it" — confirmed in [Q3](./OPEN_QUESTIONS.md).
   - `quickAdd` → touches nothing but the log
4. Logs are editable and deletable (it is a personal record of your own day). Deleting a log
   restores the derived portions/stock it consumed, because both are computed, not stored.

## Shopping

Not an entity. The shopping list is a derived view plus a thin overlay of user state.

```ts
type ShoppingLine = {                 // fully derived
  ingredientId: Id;
  required: CanonicalQuantity;        // from plan requirements
  inPantry: CanonicalQuantity;
  toBuy: CanonicalQuantity;           // max(0, required − inPantry)
  sources: { recipeId: Id | null; date: IsoDate; amount: CanonicalQuantity }[];
};

type ShoppingOverlay = {              // the only stored part
  id: Id;
  windowKey: string;                  // identifies the plan window this overlay belongs to
  checked: Id[];                      // ingredient ids ticked off
  suppressed: Id[];                   // "I don't need this after all"
  manual: { id: Id; ingredientId: Id; quantity: CanonicalQuantity }[];
};
```

```ts
shoppingList(range) = requirements(range) − pantry(), lines where toBuy > ε,
                      plus overlay.manual, minus overlay.suppressed
```

**Invariants**

1. The computed list is **never** persisted. Change the plan or the pantry and the list is
   different immediately — the failure mode of every "generate list" product.
2. Ticking a line writes a `purchase` `StockMovement` for the bought amount and records the
   tick in the overlay. That is how the pantry stays accurate without deliberate upkeep.
3. `sources` gives provenance ("why is 1.3 kg of chicken on my list?") and drives the
   group-by-recipe view. It is computed during aggregation, not stored.
4. `toBuy` is floored at zero. Surplus stock is not a negative shopping line.
5. Which plan window feeds the list is a product decision, not a modelling one — see
   [Q5](./OPEN_QUESTIONS.md).

## Insights

Entirely derived from logged meals. There is no insights entity, no aggregate table, and no
scheduled rollup.

Every insight is a fold over one primitive — the ingredient-level `Contribution`, defined in
[NUTRITION_MODEL.md](./NUTRITION_MODEL.md):

```ts
type Contribution = {
  ingredientId: Id | null;      // null = quickAdd, unattributable
  ingredientName: string;
  quantity: CanonicalQuantity | null;
  nutrition: Nutrition;
  source: { logId: Id; date: IsoDate; slot: MealSlot; recipeId: Id | null; batchId: Id | null };
};
```

Daily and weekly totals, calories by slot, by recipe, by ingredient, and per-recipe
attribution are all `groupBy` + `sum` over `Contribution[]`. One tested expansion function,
then trivial folds — which is exactly why the calculation core is testable without any UI.

**Invariant:** every insight over a period must reconcile — `Σ by-slot = Σ by-recipe =
Σ by-ingredient (+ unattributed) = daily total`. This is the single most valuable property
test in the codebase.

## What is deliberately not modelled in v1

Users and households · sync and devices · physical containers · storage locations and expiry
alerting · nutrition goals and targets · recipe versioning · food-database provenance ·
micronutrients · costs and budgets.

Each has a clear later home: `Ingredient` gains fields, `Nutrition` gains keys, `Batch`
gains container rows, a `Goal` entity slots beside Insights. None requires reshaping the
five core distinctions above, which is the point of keeping the model this small.
