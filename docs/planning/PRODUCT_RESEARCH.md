# Product Research

Reference-product research for Recipe PWA. Sources reviewed August 2026 (vendor sites,
help centres, store listings, third-party reviews). Purpose: decide which interaction
patterns to adopt, which to reject, and where the product has room to be distinctive.

Recipe PWA is a **meal-prep and nutrition** app, not a calorie tracker. The loop is:

```
Ingredients → Recipes → Pantry → Meal Plan → Shopping → Batch/Portions → Meal Log → Insights
```

## Reference products

### MyFitnessPal — logging and nutrition discipline

The mature reference for *recording what was eaten*.

| Observed pattern | Verdict |
| --- | --- |
| Diary organised by day → meal slot (breakfast/lunch/dinner/snacks) | **Adopt.** Matches our plan/log slot model. |
| Recipe box with servings + per-serving nutrition derived from ingredient lines | **Adopt.** This is our core recipe rule. |
| "Save & Log It" — create a recipe and log it in one flow | **Adopt.** Log-from-anything is the highest-value shortcut. |
| Quick Add (log bare calories/macros with no food item) | **Adopt, narrowly.** Honest escape hatch for eating out; must be visibly unattributable. |
| Multi-day logging / copy meals from a previous day | **Adopt later.** Cheap once the log model exists. |
| Macros per meal slot, per-meal calorie targets | **Defer.** Needs a goals model we have not decided on. |
| Barcode scanning, photo "Meal Scan", 20M-item food database | **Exclude.** Brief says a personal ingredient library first; external DBs are a later option, not a prerequisite. |
| Recipe importer that fuzzy-matches free-text ingredient lines to database items | **Exclude for now.** Depends on a large external food DB. |
| Premium gating, ads, streaks, social feed | **Exclude.** Single-user personal app. |

Key lesson: MyFitnessPal's ingredient-level recipe breakdown answers "what is in this dish"
but its diary cannot answer "which ingredient did this week's calories come from", because
logging collapses a recipe into a single diary row. That gap is our Insights opportunity.

### Samsung Food — the connected loop, at consumer scale

The closest product to our intended shape: recipe box → drag-and-drop weekly planner →
one-click shopping list → nutrition and health scores, with pantry management and adaptive
nutrition tracking behind Food+.

| Observed pattern | Verdict |
| --- | --- |
| Drag-and-drop recipes into a weekly plan grid | **Adopt.** Primary planning interaction (dnd-kit). |
| One action turns a plan (or a single recipe) into a shopping list | **Adopt**, but computed as `requirements − pantry`, not a raw ingredient dump. |
| Shopping list sortable **by recipe** or **by aisle/category** | **Adopt.** Cheap, and the aisle grouping is what makes a list usable in a shop. |
| Nutrition calculated for user-authored recipes, not just curated ones | **Adopt.** Non-negotiable for us. |
| Reusable saved plans ("save and reload a favourite week") | **Adopt later.** Good fit for repetitive personal cooking. |
| Recipe capture from any website via browser extension | **Exclude.** Scraping/parsing is a project of its own. |
| Communities, sharing, 240k public recipes, guided recipes | **Exclude.** Not a social product. |
| AI-generated weekly plans, Vision AI pantry, retailer delivery integrations | **Exclude.** Out of scope; also the parts users trust least. |
| Single composite "health score" per recipe | **Exclude.** Judging food is not our job; we report and attribute. |

Key lesson: Samsung Food proves the loop is desirable, but its pantry and its planner are
loosely coupled — pantry feeds *suggestions*, and the plan is expressed in recipes, so
prepped leftovers are invisible to both the plan and the shopping maths.

### SuperCook — pantry-first, "what can I make?"

An ingredient-first reverse search: you maintain a virtual pantry from a ~2,000-item
catalogue and it surfaces recipes you can cook right now, plus recipes you could cook with
one or two more items.

| Observed pattern | Verdict |
| --- | --- |
| Three-state availability: makeable now / missing one or two / missing more | **Adopt.** This is the pantry feature the brief asks for. |
| Ingredient chips grouped by category, tap to add/remove | **Adopt.** Fast pantry entry without a form per item. |
| Results re-derive instantly when pantry changes | **Adopt.** Availability is a computed view, never stored. |
| "Missing one item" → add straight to a shopping list | **Adopt.** Closes the loop from availability to shopping. |
| Ignores quantities entirely — pantry is presence/absence | **Reject.** Our pantry is quantitative (1.2 kg chicken), which is what makes shopping subtraction possible. |
| Voice dictation and AI fridge-photo recognition for pantry entry | **Exclude.** Nice, unnecessary, and expensive. |
| 11M scraped recipes across 18k sites | **Exclude.** Personal recipe library instead. |

Key lesson: reviewers consistently note two things — the pantry only pays off if keeping it
accurate is nearly free, and SuperCook "stops at the list". Pantry upkeep must therefore be
a by-product of actions the user already takes (shopping, cooking, logging), never a chore.

### Eat This Much — planning against nutrition targets

Generates daily/weekly plans from calorie and macro targets, with a virtual pantry that the
generator deliberately consumes first, automatic grocery lists, per-meal household sizing,
and "automatic leftovers".

| Observed pattern | Verdict |
| --- | --- |
| Plan is the primary artefact; following the plan *is* the tracking | **Adopt.** Logging a planned meal must be one tap. |
| "Automatic leftovers" — cook once, plan the remainder into later slots | **Adopt, and go further.** This is the Batch/Portion concept, made explicit. |
| Pantry prioritised when planning, so stock gets used up | **Adopt later** as a "uses what you have" sort on the recipe picker. |
| Grocery list recomputes when the plan or a target changes | **Adopt.** Derived list, no stored snapshot. |
| Per-meal servings for household size | **Adopt** as recipe/plan servings scaling. |
| Automatic plan generation from macro targets | **Exclude.** Users report repetitive output; and it inverts our model — we help you plan, we don't decide for you. |
| Retailer delivery, PDF export, coach/client dashboards | **Exclude.** |

Key lesson: Eat This Much treats leftovers as a planner trick rather than a tracked
inventory, so it cannot tell you how many portions of Sunday's curry are actually left.

## Where the references leave a gap

All four products own one segment of the loop well and hand off badly:

| Segment | Best reference | What breaks at the boundary |
| --- | --- | --- |
| Nutrition + logging | MyFitnessPal | No pantry, no plan, no leftovers; recipes collapse on logging so attribution is lost. |
| Recipes + planning + shopping | Samsung Food | Pantry only advises; prepped food is invisible to plan and list. |
| Pantry → recipe availability | SuperCook | No quantities, no nutrition, no plan, no logging. |
| Plan → targets → grocery list | Eat This Much | Leftovers are implicit; no real inventory; generation over authorship. |

A separate 2026 comparison of dedicated meal-prep apps reaches the same conclusion from the
other side: prep-focused apps have the batch/container workflow but estimated nutrition and
no real inventory, while nutrition trackers have the data but no prep workflow. Container-
and portion-level tracking is the segment nobody joins up with quantitative nutrition.

## Recipe PWA opportunities

Ordered by how distinctive they are.

1. **Batch and Portion as first-class, quantitative entities.** Cooking a Recipe creates a
   Batch with a portion count and nutrition frozen at cook time. Portions are then planned,
   logged (including half portions), and depleted. This single decision fixes the leftovers
   gap in all four references at once.
2. **Ingredient-level calorie attribution across logged meals.** Answer "where did my
   calories come from?" — by meal, by recipe, and by ingredient — by expanding every logged
   entry down to ingredient contributions. No reference product does this over a week.
3. **One quantitative pantry serving three consumers.** The same stock quantities drive
   availability ("what can I make?"), shopping subtraction, and batch cooking deductions.
   SuperCook has availability without quantities; Samsung Food and Eat This Much have
   quantities without a real inventory ledger.
4. **Shopping as pure arithmetic, always live.** `plan requirements − pantry stock`,
   recomputed on every change, with planned Portions correctly requiring *nothing* because
   they are already cooked. Never a stored, stale list.
5. **Pantry accuracy as a by-product.** Ticking off shopping, cooking a batch, and logging a
   portion each move stock automatically. The pantry stays true without dedicated upkeep —
   the failure mode every pantry app suffers.
6. **Explicitly no scores, no coaching, no judgement.** Report and attribute; never grade a
   recipe A–E or nudge. This is both a product position and a design constraint.
7. **Offline-first personal PWA.** Local data, no account, no network dependency, instant.
   Every reference product is a cloud service with a sign-up wall.

## Deliberately excluded from v1

Recorded so later tickets do not relitigate it: external food databases and barcode
scanning, recipe scraping/import from URLs, AI plan generation or photo recognition, social
and community features, retailer/delivery integrations, composite health scores or diet
grading, multi-user households and sharing, coaching/client management, subscriptions and
gating, micronutrients beyond the initial four macros, exercise and weight tracking.

Several of these are model-compatible later additions (external food DBs, micronutrients,
saved plans, copy-a-day). The domain model is shaped so they can be added without rework —
see [DOMAIN_MODEL.md](./DOMAIN_MODEL.md) and [NUTRITION_MODEL.md](./NUTRITION_MODEL.md).
