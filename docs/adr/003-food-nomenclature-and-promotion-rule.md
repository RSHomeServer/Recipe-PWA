# ADR-003: Food nomenclature and the ingredient→recipe promotion rule

## Status

Accepted. Clarifies V1 decisions 4, 7 and 14 without changing any entity. Governs all
user-facing wording.

## Context

The model is right and the words are wrong. Three specific failures, each reported from use:

**"Already cooked (batch portion)" is unreadable.** It is the label for `batchPortions` in the
plan composer. It reads as a question — already cooked by whom, when, and why is this a choice
I am being asked to make? The concept it names is genuinely useful (eat a portion of something
you batch-cooked earlier) but the label describes the entry's *tense* rather than the thing
the user is choosing, which is **where tonight's food comes from**.

**The boundary between Ingredient and Recipe is undefined.** The natural reading of "a recipe
is something you cook" puts frozen hashbrowns on the recipe side, since you do cook them. But
a "Hashbrowns" recipe whose single line is 200 g of the ingredient "Hashbrowns, frozen" is
pure indirection: two names to keep in sync, a servings figure that means nothing, and an
implied cook-a-batch-and-count-portions flow that does not apply to four hashbrowns in an
oven. The user correctly suspected this and correctly noted that the existing eat-as-is entry
already covers it. What was missing was not a capability but a **stated rule**.

**The workflow is never explained where it is being used.** V1 put explanatory text on every
plan tile, where it is repetition, and almost none in the composer, where the choice is
actually made. See [ADR-001](./001-page-geometry-and-density.md) §4 for the layout half of
this; this ADR supplies the words.

## Decision

### 1. The boundary rule: a recipe has a yield you divide

The distinction is **not** whether heat is involved.

> **Ingredient** — one thing you buy. Nutrition is defined per 100 g, 100 ml or 1 item.
> Heating it, or plating it, changes nothing the model tracks.
>
> **Recipe** — a composition with a yield. Two or more ingredients combined and divided into
> servings. It is the thing you scale, and the only thing you can cook a batch of.

So: frozen hashbrowns are an **ingredient**. So are chicken thighs, a jar of BBQ sauce, frozen
peas, a pot of yoghurt, a banana. You plan them directly, they go on the shopping list, and
they come out of the pantry when you log them. No recipe is involved and none is needed.

**The promotion test.** Promote an ingredient to a recipe only when **both** hold:

1. It combines **two or more** ingredients, and
2. You want per-serving nutrition, scaling, or portion tracking for the combination.

Fail either and it stays an ingredient.

**No, ingredients are not promoted to recipes by default**, and single-ingredient recipes are
an anti-pattern. The recipe editor warns when a recipe would be saved with exactly one line
and `servings === 1`: *"This is a single ingredient. You can plan and log it directly from the
ingredient library — you only need a recipe when you are combining things."* The warning is
dismissible, not blocking; there are legitimate edge cases (a marinade you scale), and this
product warns rather than refuses.

**And if you want chicken thighs *and* hashbrowns together as one thing?** That is neither an
ingredient nor a recipe. It is a **meal**, and it gets its own concept — see
[ADR-004](./004-meal-templates-by-expansion.md). This is the answer to the question the
hashbrowns case was really asking.

### 2. What a Batch is for, stated plainly

The entity is unchanged (V1 decision 7). Its purpose was never written down in words a user
reads:

> **A batch is one cooking session.** You cooked a recipe, it made a certain number of
> portions, and those portions are now food that exists in your fridge or freezer. Planning to
> eat one adds nothing to your shopping list, because you already bought and cooked it.

That paragraph is the product's actual differentiator and it should appear in the Cook route's
header and in an info popover wherever `batchPortions` is offered.

The word "batch" is kept. "Leftovers" undersells deliberate meal prep, "meal prep" is a verb
phrase, and "batch" is already what people who do this call it.

### 3. The plan and log composers ask one question, on the right axis

The choice is **where the food comes from**, not what tense it is in. Three options, in this
order, with this wording:

| Entry kind | Label | Helper text | Shopping | Pantry |
| --- | --- | --- | --- | --- |
| `recipeServings` | **Cook a recipe** | "You'll cook this fresh. Its ingredients go on the shopping list." | Adds | Deducted when you cook, not when you plan |
| `batchPortions` | **Eat a portion you already cooked** | "From a batch in the fridge or freezer. Nothing to buy — this food already exists." | Adds nothing | Untouched |
| `ingredient` | **Eat or heat one item** | "One thing, straight from the pack: hashbrowns, yoghurt, fruit. Goes on the shopping list." | Adds | Deducted when you log it |

The question itself, replacing "What to plan": **"Where's this coming from?"**

When the user has no batches available, the middle option renders disabled with the reason
given — *"No batches yet. Cook a recipe and its portions appear here."* — rather than being
hidden. A capability that silently does not appear is a capability the user never learns
exists.

### 4. The full lexicon

Binding on all UI copy. Where a component and this table disagree, this table wins.

| Concept | Term used in the UI | Never called | One-line definition shown to the user |
| --- | --- | --- | --- |
| `Ingredient` | Ingredient | Food, item, product | "One thing you buy, with its nutrition per 100 g, 100 ml or item." |
| `Recipe` | Recipe | Dish, meal | "Ingredients combined into servings. Scale it, cook it, track its portions." |
| `Batch` | Batch | Leftovers, cook, prep, session | "One cooking session, and the portions it produced." |
| Portion | Portion | Serving | "One helping of a batch. Half portions are fine." |
| Serving | Serving | Portion | "One helping of a recipe as written." |
| `MealTemplate` ([ADR-004](./004-meal-templates-by-expansion.md)) | Meal | Combo, profile, bundle, preset | "A saved combination you eat often — a recipe, some items, or both." |
| `PlannedMeal` | Planned | Scheduled | "What you intend to eat. Planning changes nothing physical." |
| `LoggedMeal` | Logged | Tracked, recorded, consumed | "What you actually ate." |
| `PantryStock` | Pantry | Inventory, stock levels | "Raw ingredients you have now." |
| Availability | "Ready to cook" / "Almost" / "Missing items" | Can't make, unavailable, blocked | Never phrased as a refusal — availability never gates an action. |

**Serving and portion are not synonyms and must never be swapped.** A serving belongs to a
recipe as written; a portion belongs to a batch that exists. Using them interchangeably
collapses the product's core distinction in exactly the place the user is looking at it.

### 5. Explanation is progressive, and never depends on hover

Four mechanisms, in order of how much they intrude:

1. **Helper text under a field** — permanently visible, `--font-size-sm`, `--color-muted`.
   This is the default and carries anything that changes behaviour. The table in §3 is helper
   text.
2. **Info popover** — a 44px `?` button opening a `Popover` (not a `Tooltip`) for the longer
   definitions in §4. A popover works on touch, is keyboard-reachable and does not depend on a
   pointer. Used for "what is a batch?", "what does archiving do?", "why isn't this on my
   shopping list?".
3. **A dismissible "How this works" panel** at the top of Plan and Cook on first visit,
   describing the loop in four sentences: stock the pantry → cook a recipe into a batch →
   plan portions and items across the week → shop for the difference. Dismissal is persisted
   in `Settings`; a link in Settings brings it back.
4. **Hover `Tooltip`** — reserved for icon-only buttons on pointer devices, duplicating the
   `aria-label` that DESIGN.md §9 rule 10 already requires. **A tooltip may never be the only
   place information appears** (§9 rule 2). This is the constraint that matters most, because
   tooltips are the tempting answer and they are invisible on the phone where this product is
   mostly used.

## Consequences

Positive: the hashbrowns question has a written answer that generalises; "already cooked
(batch portion)" is gone; the product's differentiator is stated in words a user reads rather
than only in a domain model; copy stops being invented per screen.

Negative: this is a wide, shallow change — most feature directories contain a string this
table touches. It is mechanical but it is not small, and it will produce a large diff with no
behavioural change, which reviewers should expect.

Neutral: no entity, schema, migration or calculation changes. `PlanSlotTileVariant` keeps its
`"cook" | "portion" | "ingredient"` values; only the strings rendered from them change.

## Verification

1. A repository-wide search finds no occurrence of "Already cooked", "Still to cook",
   "Eat as-is" or "What to plan" outside this ADR and the planning docs' change history.
2. The lexicon's terms are the only ones used for those concepts across `src/features/`; the
   banned column produces no matches in user-visible strings.
3. The recipe editor shows the single-ingredient warning for a one-line, one-serving recipe,
   and still saves when the user proceeds.
4. With no batches present, the "Eat a portion you already cooked" option renders disabled
   with its reason visible, and is not removed from the DOM.
5. Every info popover is reachable and dismissible by keyboard alone, and no information
   appears only inside a hover tooltip.
