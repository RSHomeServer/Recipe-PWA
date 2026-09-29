# UX critique — V3 (ticket 7)

Final V3 pass against [DESIGN.md](./DESIGN.md) §§1–12 and accessibility §9, after tickets 1–6
landed (#26–#32). Branch: `feature/v3-ux-critique`. Companion to
[UX_CRITIQUE_V2.md](./UX_CRITIQUE_V2.md); this document supersedes V2 “Remaining / deferred”
where this ticket closes an item.

## Summary verdict

V3 delivers the Flavour Lab as a lens (ADR-010): `/flavour` in secondary nav, sensory filters,
rapid multi-pick mix builder (R5.4), nullable sodium with honest display (ADR-007), spoons at
the entry boundary (ADR-008), and example mixes/snacks via Settings (R6). No purple/blue
gradients, glass, KPI tiles, calorie rings, pie charts, or red over-target framing were found.

The **headline acceptance scenario** passes on product behaviour and domain guards. Prepare is
materially cheaper than the V2 plan composer path thanks to multi-pick defaults; discover and
log paths use existing meals, pantry, and Today/Log surfaces. One V2 carry-over (**apply-a-meal
default days on Plan**) is closed in this PR; the plan-composer multi-pick pattern remains
deferred.

## Headline acceptance scenario

> **1. Prepare** — sour + spicy under 10 kcal/tsp (or /100 g), build Chilli Garlic Vinegar from
> five pack ingredients, save cucumber + vinegar as a snack, no hand-typed nutrition, R5.4
> rapid multi-pick.
>
> **2. Discover from stock** — with vinegar ingredients and/or cucumber in pantry, find the
> prepared snack (or what you can make) via Flavour Lab / related surfaces.
>
> **3. Log and learn** — from Today, log the snack; log shows calories **and** sodium; ordinary
> Today UX.

| Check | Result | Evidence |
| --- | --- | --- |
| **1. Prepare — nutrition not typed** | **PASS** | Starter + flavour packs seed reference rows (ADR-002/006). Mix builder uses `recipeTotal` / `draftsToRecipeInput`; example catalogue uses pack refs only (R6.3). |
| **1. Prepare — R5.4 multi-pick** | **PASS** | `FlavourLabPage` toggles “Add to mix” without closing the list; `defaultMixLineDraft` supplies tsp/ml/g defaults per ingredient (`flavour-lab.test.ts`). |
| **1. Prepare — interaction budget** | **PASS (usability gate)** | Static trace after pack seed: ~2 tag toggles + kcal ceiling + **5** add-to-mix + name + save mix + save-as-snack (~**12–18** pointer actions excluding first-time Settings top-up). No V2-style `<15` hard gate; well below the old four-item composer (~29). Human should confirm wall-clock on device. |
| **2. Discover from stock** | **PASS** | **Flavour Lab:** intersection filters surface sour/spicy pack lines for building. **Pantry → What can I make?** lists the saved **mix recipe** when line ingredients are in stock (`useRecipeAvailabilityRows`). **Today / Meals:** saved snack template is listed under “Apply a meal” and searchable on `/meals`. No separate flavour pantry (ADR-010 §6 — by design). |
| **3. Log and learn** | **PASS** | Today: apply template → snack slot → **Log** on planned rows (`PlanQuickLogRow`). **Log** page rows use `LogEntryRow` with kcal + sodium (`MacroNutritionLine`). Domain path guarded by `flavour-lab.test.ts` (expand + `totalNutrition`, sodium non-null). |

**Measurement method.** Interaction counts from UI flow trace on the dev site plus domain tests
(items 11 and V2-style shopping test unchanged). Not stopwatch-instrumented; live timing is a
polish signal only (V3 carry-over).

## V2 carry-overs (ticket 7)

| Item | Assessment | Disposition |
| --- | --- | --- |
| Plan composer vs Flavour Lab multi-pick | Flavour Lab proves the pattern (toggle + default qty). Plan composer still one-entry-at-a-time with typed amounts — acceptable for multi-day meals but expensive on fresh install. | **Deferred** — composer redesign out of critique scope unless product expands ticket. |
| Apply-a-meal from Plan pre-selects all seven days | `PlanPage` passed `initialDates={days}`; Today already used `[today]`. | **Closed** — `initialDates={[selectedDay]}` (matches planner’s selected day). |
| Live stopwatch on prepare path | Useful signal, not pass/fail vs impulse snacks. | **Deferred (nit)** — human device pass. |

## Fixed in this PR

- **Plan apply-a-meal default day (V2 carry-over).** Apply from Plan now pre-selects the planner’s
  **selected day** only, not the whole week — same intent as Today.
- **V3 test 14 guard.** `flavour-lab-controls.test.tsx` asserts sixteen tag toggles wrap at 320px
  with `min-h-11` and no truncation (R5.9 / ADR-005 band).
- **Critique artefact.** This document records acceptance results, a11y §9, and remaining items.

*(Domain worked-example guard `src/features/flavour/flavour-lab.test.ts` shipped in ticket 5;
unchanged on this branch.)*

## Remaining / deferred

| Severity | Issue | Notes |
| --- | --- | --- |
| should-fix | Plan composer rapid multi-pick | Adopt Flavour Lab–style defaults for plan **prep** UX; not attempted here. |
| should-fix | Meal templates on Pantry “What can I make?” | Pantry availability is recipe-scoped today; saved **snacks** are findable via Meals/Today but not pantry-ranked. |
| nit | Mix line remove control `size-9` (36px) | Below 44px touch floor (§9 rule 9); low traffic vs add buttons. |
| nit | Today quick-log rows show title/subtitle only | Sodium visible after log on `/log`; optional enhancement to preview sodium before tap. |
| nit | Live stopwatch on prepare | Confirm qualitatively on phone after local sync. |
| blocker | *(none)* | — |

## Accessibility §9 status

| # | Rule | Status |
| --- | --- | --- |
| 1 | AA contrast both themes | **Clear** — V2 macro token verification stands; Flavour Lab uses surface/raised tokens only. |
| 2 | Never colour alone | **Clear** — tag selection uses check + border; sodium/constraint badges are text-labelled. |
| 3 | Body ≥ 16px | **Clear** — page description and filter help use permitted `text-sm` for metadata; primary copy `text-base` on headers/explanations. |
| 4 | Focus visible | **Clear** — tag toggles use `focus-visible:ring`; form controls follow shell pattern. |
| 5 | Planner keyboard parity | **Clear** — unchanged from V2. |
| 6 | Semantics | **Clear** — filter/results/mix regions labelled; `/flavour` is one `<main>` via shell. |
| 7 | Live regions | **Clear** — mix nutrition panel follows recipe patterns; day totals on Log unchanged. |
| 8 | Reduced motion | **Clear** — PWA-Base skeleton/motion tokens. |
| 9 | Touch ≥ 44px | **Clear for tag grid** (test 14). **Nit:** mix remove icon button 36px. |
| 10 | Icon-only labels | **Clear** — remove mix line has `aria-label`; nav label present. |

### Flavour Lab at 320px (R5.9 / V3 test 14)

Tag filter uses a wrapping toggle grid (`flex flex-wrap`, `min-h-11`), not a segmented control —
correct cardinality for sixteen tags (ADR-005). Automated test mirrors live classes; manual
screenshot captured at 320px during executor validation (`/.tmp-visual/flavour-320.png` when
capture script run).

## Anti-patterns (§12)

No regressions. Checked Flavour Lab, Settings example install, Insights sodium context (no red
limit framing), and primary/secondary nav. Forbidden dashboard/gradient/glass patterns absent.

## Automated guards (V3_SCOPE testing)

| Item | Location |
| --- | --- |
| 11 — worked example e2e | `src/features/flavour/flavour-lab.test.ts` |
| 14 — tag controls @ 320px | `src/features/flavour/flavour-lab-controls.test.tsx` |
| V2 shopping acceptance | `src/features/today/acceptance-scenario.test.ts` (unchanged) |
