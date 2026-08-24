# Open Questions

Decisions that **block implementation**. Each has a recommendation so work is not stalled if
the answer is simply "agreed" — but each also has a consequence that is expensive to reverse
once data exists, which is why it is here rather than being decided quietly in a ticket.

Questions that do *not* block anything are in the last section, with the default taken.

| # | Question | Blocks | Recommendation | Decision |
| --- | --- | --- | --- | --- |
| [Q1](#q1) | Are ingredient nutrition edits retroactive? | Ingredients, Insights | Accept retroactivity for recipes and ingredient logs; never for batches | **Decided (human):** version by date — `nutritionHistory` + resolve logs by date in `expand()`. Batches remain frozen. Overrides the recommendation. |
| [Q2](#q2) | Portions or physical containers? | Batches, Logging | Portion count only | Open |
| [Q3](#q3) | Does cooking automatically deduct pantry stock? | Pantry, Batches | Yes, with a confirm step and editable quantities | Open |
| [Q4](#q4) | Does the planner separate cook day from eat day? | Meal plan, Shopping | Yes — plan meals, derive cook sessions | Open |
| [Q5](#q5) | Which plan window feeds the shopping list? | Shopping | User-chosen range, defaulting to the next 7 days | Open |
| [Q6](#q6) | Batch portions: reserved when planned, or free-for-all? | Meal plan, Logging | Warn on over-commitment; do not hard-reserve | Open |
| [Q7](#q7) | Single device, no sync, for v1? | Persistence, whole architecture | Yes — local only, with JSON export/import | Open (human parked / decide later) |
| [Q8](#q8) | Are nutrition targets in v1? | Insights, DESIGN.md charts | No — absolute figures only in v1 | Open |
| [Q9](#q9) | Who owns the interactive component layer? | UI foundation (first ticket) | shadcn/ui owns it; PWA-Base owns tokens, theme, shell, display primitives | **Decided (human):** accept recommendation — shadcn owns interactive layer |

---

## Q1 — Are ingredient nutrition edits retroactive? {#q1}

**The question.** You recorded chicken breast at 165 kcal/100 g. In March you correct it to
172. Batches cooked before March keep the old figure — that is settled, because
[Batch snapshots are frozen](./DOMAIN_MODEL.md). But what about a **recipe** (which computes
live) and a logged **`ingredient`** entry (which also computes live)? Both will silently
restate history.

**Why it blocks.** It decides whether `Ingredient` needs nutrition *versioning* (an effective
date per nutrition record, with logs resolving against the version current at the time). That
is a schema-level change: retrofitting it after logs exist means a migration and a rewrite of
`expand()`.

**Recommendation (Architect, not taken):** accept the retroactivity and do not version.

**Decision (human):** **must be versioned.** Add `nutritionHistory: { from: IsoDate; nutrition }[]`
to `Ingredient` and resolve by log date in `expand()`. Batches remain frozen at cook-time
snapshots. DOMAIN_MODEL / NUTRITION_MODEL must be updated to match before the Ingredients
ticket.

---

## Q2 — Portions or physical containers? {#q2}

**The question.** [DOMAIN_MODEL.md](./DOMAIN_MODEL.md) models a Batch as a portion *count*
with `portionsRemaining` derived. The alternative is a row per physical container, so you can
say "I ate container #3" and "container #5 went in the freezer".

**Why it blocks.** Containers are entities with their own identity, location and state. They
cannot be retrofitted onto a count without a migration, and they change the logging UI from a
stepper to a picker.

**Recommendation: portion count only.** "2.5 portions left" carries the decision-useful
information; which tub it is in does not. Container identity earns its place only alongside
storage locations and expiry tracking, which are both V2. The 2026 meal-prep app comparison
that flagged container tracking as a market gap also shows it paired with location and expiry
features we have deliberately deferred.

**Reversal cost if wrong:** low. Adding `Batch.containers[]` later is additive; the portion
count remains the aggregate.

---

## Q3 — Does cooking automatically deduct pantry stock? {#q3}

**The question.** Two related halves:

- **(a)** Creating a Batch: does it write `cooked` stock movements for every ingredient used?
- **(b)** Logging a `recipeServings` meal with **no** batch (cooked and eaten immediately):
  does that deduct stock too?

**Why it blocks.** It determines whether the pantry can be trusted, and therefore whether
availability and the shopping list mean anything. It also decides where deduction logic
lives. Both the Pantry and Batches tickets need the answer.

**Recommendation:**

- **(a) Yes**, with a confirmation step. The cook flow shows the scaled quantities, lets the
  user edit actuals ("I used 550 g"), warns where stock is insufficient, and on confirm writes
  the movements *and* the snapshot from the same edited numbers. This is the single mechanism
  that keeps the pantry accurate without dedicated upkeep — the failure mode every pantry app
  suffers ([PRODUCT_RESEARCH.md](./PRODUCT_RESEARCH.md)).
- **(b) Yes, by making that path go through a Batch.** "Cook and eat now" creates a
  one-portion Batch and logs it. No second deduction path, no divergence between the two
  routes, and the meal still appears in attribution with a frozen snapshot. A `recipeServings`
  log then only ever means "I ate this recipe but did not track cooking it" — an escape hatch
  that deliberately does not touch stock.

**If deduction should be manual:** the pantry becomes advisory only, and the shopping list
becomes unreliable — which removes the product's main differentiator. Worth stating plainly.

---

## Q4 — Does the planner separate cook day from eat day? {#q4}

**The question.** Meal prep means cooking a batch on Sunday and eating it Monday to
Wednesday. Does the planner model this — a **cook session** distinct from the meals it feeds —
or does the user plan a recipe on Sunday and three batch-portion meals afterwards by hand?

**Why it blocks.** It is the difference between a generic meal planner and a meal-prep
planner, it shapes the entire planner UI, and it changes shopping arithmetic (a cook session
needs ingredients; the portion meals it feeds must not double-count them).

**Recommendation: plan meals, derive cook sessions. Do not add a `CookSession` entity.**

Keep `PlannedMeal` as the only planning entity, and let the planner *compute* what needs
cooking and when:

- Planning "Chicken Curry × 4 servings" on Monday creates a **cook requirement**.
- The UI offers "cook this once and spread it" — which creates several planned meals, one per
  slot, and marks one as the cook slot.
- A derived "prep list" view answers "what must I cook on Sunday to cover Mon–Wed?" by
  grouping planned recipe meals by an assigned cook date.

This needs one additive field — `PlannedMeal.cookOn: IsoDate | null` (null = cook when eaten)
— and no new entity. The shopping arithmetic already works: `recipeServings` entries require
ingredients, `batchPortions` entries require nothing.

**Confirm:** is the derived approach acceptable, or is an explicit cook-session artefact
wanted (a "Sunday prep session" you open, work through, and complete)? The latter is a
better cooking *experience* and a worse *model* — and it is genuinely additive later, once
real usage shows whether the prep view is used as a checklist.

---

## Q5 — Which plan window feeds the shopping list? {#q5}

**The question.** `shopping = requirements(range) − pantry`. What is `range`? A rolling 7
days? A calendar week? An explicit date range? "Everything from now until the next planned
shop"?

**Why it blocks.** It defines `ShoppingOverlay.windowKey` (which ticks belong to which shop),
and it decides whether a "shopping trip" is a concept the product knows about.

**Recommendation: an explicit user-chosen date range, defaulting to the next 7 days from
today.** Shown and editable at the top of the shopping view. `windowKey` is the serialised
range. This is understandable, matches how people shop, and needs no new entity.

Consequence to accept: change the range and ticks made under the old range no longer apply.
Mitigation — keep overlays keyed by range and offer "carry ticks over" when a range is
adjusted rather than silently discarding them.

**If a "shopping trip" entity is wanted** (a shop you open, tick through, and close, with
history of what you bought), say so now. It is a reasonable V2 built on `purchase`
movements, which already record everything a trip history would need.

---

## Q6 — Batch portions: reserved when planned, or free-for-all? {#q6}

**The question.** A batch has 4 portions. You plan one for Monday, Tuesday and Wednesday
lunch. Are those 3 portions **reserved** — so the pantry-style "remaining" count drops
immediately, and planning a fourth for Thursday plus a fifth for Friday is refused?

**Why it blocks.** It decides whether `portionsRemaining` has one meaning or two ("physically
left" vs "left and uncommitted"), which affects the planner UI, the logging UI, and the
derivation itself.

**Recommendation: do not reserve. Warn instead.** Keep `portionsRemaining` meaning exactly
one thing: physically left, reduced only by logging and discarding. Add a separate derived
`portionsCommitted` (the sum of future planned portions) and show a non-blocking warning when
`committed > remaining` — "you've planned 5 portions of a 4-portion batch".

Rationale: reserving makes plan and reality fight each other. Plans change constantly, and a
planner that refuses your intent because of a soft commitment is annoying rather than
helpful. Keeping the plan advisory and the count physical preserves the
[plan-is-intent, log-is-fact](./DOMAIN_MODEL.md) distinction that the whole model rests on.

---

## Q7 — Single device, no sync, for v1? {#q7}

**The question.** Everything above assumes one user, one browser, local IndexedDB, no
account, no server. Confirmed?

**Why it blocks.** It is the largest architectural fork in the project. Sync requires a
backend, auth, conflict resolution and — critically — a rethink of the append-only pantry
ledger and derived-everything model, which are cheap locally and non-trivial when merged
across devices. It cannot be bolted on.

**Recommendation: yes, local-only for v1, with JSON export/import as the data-protection
route** (in v1 scope for that reason, not as a nicety). Offline-first with no sign-up is
also a genuine differentiator — every reference product is a cloud service behind a wall.

The realistic concern is not sync but *phone plus laptop*: logging happens on a phone,
recipe authoring and insights on a desktop, and local-only means two separate datasets.
Worth confirming explicitly that this is acceptable, because it is the most likely reason
this decision gets revisited.

Note in mitigation: the append-only ledger and immutable batch snapshots are unusually
sync-friendly shapes if it is ever added — mostly-additive data merges far better than
mutable rows.

---

## Q8 — Are nutrition targets in v1? {#q8}

**The question.** Does the user set daily calorie/macro goals, so Insights shows "1,850 of
2,000 kcal" and progress rings — or does v1 report absolute figures only?

**Why it blocks.** Targets change what every Insights chart *is* (progress against a goal vs
composition of an actual), and DESIGN.md must specify the chart set before the UI-foundation
ticket. It also introduces a `Goal` entity and a settings surface.

**Recommendation: no targets in v1.** The product's stated position is meal prep and
attribution, not calorie tracking, and "where did my calories come from?" is a composition
question that targets do not improve. Progress rings against a goal are also the strongest
pull toward the fitness-tracker aesthetic that [DESIGN.md](./DESIGN.md) explicitly rejects.

Adding targets later is genuinely additive: a `Goal` entity read alongside insights, with no
change to any calculation ([NUTRITION_MODEL.md](./NUTRITION_MODEL.md) extension points).

**If targets are wanted in v1**, say so now — DESIGN.md's chart section and the Insights
ticket both change materially.

---

## Q9 — Who owns the interactive component layer? {#q9}

**The question.** The brief mandates shadcn/ui. PWA-Base ships 18 CSS-Module primitives over
token variables, including `Button`, `TextField`, `Select`, `TextArea` and `Badge` — but
deliberately defers Dialog, Toast, Tooltip, Table, Tabs, Checkbox, Radio, Switch and combobox,
all of which this product needs. Do we use PWA-Base's primitives where they exist and shadcn
for the rest, or does shadcn own the whole interactive layer?

**Why it blocks.** It is the very first ticket (UI foundation), and every component built
afterwards inherits the answer.

**Recommendation: shadcn/ui owns the interactive layer.** PWA-Base keeps what it is
genuinely best at — tokens, theming, app shell, site contract, PWA runtime, and the
non-interactive display primitives (`EmptyState`, `Skeleton`, `Spinner`, `Stack`, `Divider`).

**Decision (human):** accept recommendation — shadcn owns the interactive layer; PWA-Base
owns tokens, theme, shell, and display primitives.

Rationale: sourcing buttons and inputs from both libraries means two button styles, two focus
treatments and two disabled states in one product. Because shadcn must supply the dialogs,
tables, comboboxes and toasts that dominate every dense screen here, it should also own the
controls beside them. PWA-Base's own design-system doc sanctions this — it lists *"Tailwind
in `@platform/ui` — sites may choose their own styling approach"* under what it deliberately
avoids.

**Non-negotiable either way:** shadcn's CSS variables are aliased to PWA-Base tokens and
never define their own values, and PWA-Base `ThemeProvider` drives dark mode via
`@custom-variant dark (&:is([data-theme="dark"] *))`. One token source, no drift.
Details in [ARCHITECTURE.md](./ARCHITECTURE.md).

**Worth noting for the platform:** this product needs roughly ten components PWA-Base has
deferred. If a second Songara app needs the same set, that is an ADR-003 two-consumer signal
for promoting a form/overlay kit into PWA-Base. Out of scope here; worth the Orchestrator's
attention.

---

## Decided by default — not blocking

Recorded so later tickets do not reopen them. Each is a tactical, reversible choice inside an
accepted boundary; any of them can be overridden without a migration.

| Topic | Default taken |
| --- | --- |
| Staple ingredients (salt, oil, spices) | User-managed `isStaple` flag, off by default. No seeded list — a seeded list means shipping a food database we said we would not ship. |
| Missing cross-kind conversion factor | Refuse the entry and prompt inline for density or per-item weight. Never guess ([UNIT_MODEL.md](./UNIT_MODEL.md)). |
| Ingredient categories / aisles | User-managed, with a small starter set created on first run. Reused for pantry and shopping grouping. |
| Imperial units | Excluded from v1. Additive later (one row per unit). |
| Cooked weight | Optional `Recipe.cookedWeightG`, used only for "each portion is about 350 g". Never enters a nutrition calculation. |
| Quick-add entries in Insights | Shown as an explicit "unattributed" bucket, never hidden. |
| Negative derived pantry stock | Surfaced with a one-tap correction, never clamped to zero. |
| Recipe deletion | Archive, never delete — batches and logs reference recipes. Same for ingredients. |
| Timestamps on logs | Slot only in v1 (`breakfast`/`lunch`/`dinner`/`snack`); `loggedAt` is recorded but not surfaced. |
| Meal slots | Fixed set of four in v1. Configurable slots are a V2 settings feature. |
| IDs | `crypto.randomUUID()`. |
| Week start | Monday (UK). A locale preference later. |

---

## What is needed to unblock implementation

**Decided:** **Q9** (UI foundation may proceed once explicitly started). **Q1** (Ingredients /
Insights must implement `nutritionHistory` — update DOMAIN_MODEL / NUTRITION_MODEL before
those tickets).

**Still open:** **Q7** blocks persistence architecture until answered. Everything else can be
answered while the foundation is built, provided **Q3** and **Q4** land before the Pantry
ticket (step 6) and **Q5** and **Q6** before Shopping and Meal Plan (steps 7–8). **Q8** must
land before Insights (step 10) but also affects DESIGN.md's chart section, so an early answer
is preferable to a late one.
