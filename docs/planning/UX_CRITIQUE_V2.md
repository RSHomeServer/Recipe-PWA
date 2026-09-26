# UX critique — V2 (ticket 10)

Final V2 pass against [DESIGN.md](./DESIGN.md) §§1–12 and accessibility §9, after tickets 1–9
landed (#16–#24). Branch: `feature/v2-ux-critique`. Companion to the V1 pass in
[UX_CRITIQUE.md](./UX_CRITIQUE.md); this document supersedes the V1 "Remaining / deferred"
table where it clears an item.

## Summary verdict

The V2 corrections held. Geometry is centred and role-bound (ADR-001), choice controls follow
cardinality (ADR-005), the lexicon and progressive explanation are in place (ADR-003), the
starter pack populates a real library common-first (ADR-002), and meal templates with
multi-day apply and grouped tiles work as specified (ADR-004). No purple/blue gradients, glass,
KPI-tile dashboards, calorie rings, pie charts or red over-target framing were found.

Two of the three V1 carry-overs are now **closed** (macro AA, loading skeletons); the third
(text-sm floor) is closed for genuine body copy. The one place the product does not yet meet
its own bar is the **headline acceptance scenario's interaction budget on a fresh install** —
the four-ingredient build in the composer is the cost. Shopping correctness itself is exact.

## Acceptance scenario result

> Fresh install → plan chicken thighs + hashbrowns + peas + BBQ sauce for four dinners in
> **< 60 s** and **< 15 interactions**, no nutrition typed by hand → shopping shows the correct
> four-day aggregate minus pantry.

| Dimension | Result | Detail |
| --- | --- | --- |
| **Shopping matched** | **PASS** | Four-day aggregate minus pantry is exact for all four ingredients, including a fully-covered line dropping off. Guarded by `src/features/today/acceptance-scenario.test.ts` (300 g×4 − 500 g = 700 g chicken; 800 g hashbrowns; 350 g peas; BBQ covered → absent). |
| **No nutrition typed** | **PASS** | Starter pack (ADR-002) carries kcal/macros; the user types only quantities. |
| **Interaction budget (< 15)** | **FAIL** | ~29 interactions on a literal fresh install via the most efficient path (see breakdown). Down from ~35 before this ticket's composer fix, but still over budget. |
| **Time (< 60 s)** | **Not met on first build; met on repeat** | Building the four-item meal the first time dominates. Once saved, applying it to four days is a handful of taps and well under budget. |

**Measurement method.** Counted by tracing the live UI flow (dev server on `:5305`) plus a
domain-level test for the shopping half. This is a static interaction trace, not a
stopwatch-instrumented session — the human should confirm wall-clock time in their local-sync
validation pass.

**Interaction breakdown (fresh install, after this ticket's fix):**

- Build the meal once — open composer, then per ingredient pick + amount + add, composer now
  stays open between adds: ~18.
- *Save these as a meal* → name → save: ~3.
- *Apply a meal* → tick four days (the dialog's **All days** / per-day toggles) → apply: ~8.

**Root cause.** The composer adds one entry at a time and every ingredient needs a typed
amount, so a four-ingredient meal is inherently ~4 mini-forms. The `< 15` target assumes
"four quick picks", which implies a rapid multi-pick composer with sensible default quantities
— a genuine V2-scope change, deliberately **not** attempted here (ticket 10 is critique + bounded
fixes, not a composer redesign). Recorded below as a should-fix for a future ticket.

## Fixed in this PR

- **Macro colour AA (V1 carry-over, closed).** Verified all five `--color-macro-*` tokens as
  text/legend against surface, raised and background in both themes. Dark `--color-macro-none`
  failed at **2.9:1**; lightened `#6E665C → #9A9184` (**4.8:1**). All other macros already
  passed. Tuned in **DESIGN.md §3** and `src/app/styles/app.css`, never in a component; DESIGN
  §3 preamble and §9 rule 1 updated from "provisional" to "verified".
- **Loading skeletons (V1 carry-over, closed).** `RouteStatePanel` loading state now renders
  PWA-Base `Skeleton` (shimmer, reduced-motion-aware) instead of plain muted blocks, and is
  **delayed ~150 ms** so a fast IndexedDB read never flashes one (DESIGN.md §11).
- **text-sm body floor (V1 carry-over, closed for body copy).** The two progressive-explanation
  surfaces that carry real reading copy — the `HowThisWorksPanel` loop and the `InfoPopover`
  definition body — moved from `text-sm` to `text-base` (16 px floor, §9 rule 3 / R3.5).
  Remaining `text-sm` is secondary/metadata/labels, which DESIGN §4 permits.
- **Composer flow (acceptance-scenario blocker, reduced).** The plan composer no longer closes
  after each add; it stays open with per-entry fields reset so a multi-item meal is built with
  rapid successive picks, with an explicit **Done**. Cuts the fresh-install build from ~24 to
  ~18 interactions.
- **Acceptance guard.** Added `acceptance-scenario.test.ts` reproducing the exact four-ingredient
  × four-day → shopping-aggregate-minus-pantry path, so the "shopping matched" guarantee cannot
  silently regress.

## Remaining / deferred

| Severity | Issue | Notes |
| --- | --- | --- |
| should-fix | Acceptance interaction budget on fresh install | Meeting `< 15` needs a rapid multi-pick composer (default quantities, add-without-typing) — a V2-scope feature, not a ticket-10 fix. Repeat-use (apply a saved meal) already meets budget. |
| should-fix | Apply-a-meal from Plan pre-selects all seven days | `PlanPage` passes `initialDates={days}` (whole week), so "four dinners" needs a Clear + four ticks. A default of the current day (as Today already uses) would cut interactions. |
| nit | Live stopwatch timing | Confirm `< 60 s` wall-clock in a real device pass; static trace suggests first build is the only over-budget phase. |
| nit | Charts remain `aria-hidden` with DOM table equivalents | Acceptable per §8 rule 4; keep the table for every new chart. |
| blocker | *(none)* | — |
| human gate | ~~R2.12 licence string~~ **Resolved** | Product owner confirmed OGL v3.0 from the GOV.UK CoFID page footer and the CoFID 2021 user guide PDF. Pack and Settings → About updated to `OGL-UK-3.0`. |

## Accessibility §9 status

| # | Rule | Status |
| --- | --- | --- |
| 1 | AA contrast both themes | **Closed** — all macro tokens verified ≥ 4.5:1; dark `macro-none` fixed. |
| 2 | Never colour alone | Clear — availability + macros carry text/icons. |
| 3 | Body ≥ 16px | **Closed for body copy** — explanation surfaces raised; residual `text-sm` is metadata/labels. |
| 4 | Focus visible | Clear — nav, forms, buttons use `--color-focus-ring`. |
| 5 | Planner keyboard parity | Clear — dnd-kit keyboard sensor + Move to… menu. |
| 6 | Semantics | Clear — main via shell, real tables on Insights. |
| 7 | Live regions | Clear — log day total, shopping remaining count. |
| 8 | Reduced motion | Clear — PWA-Base tokens + skeleton honours `prefers-reduced-motion`. |
| 9 | Touch ≥ 44px | Clear — steppers/ticks 48px, tile controls 44px. |
| 10 | Icon-only labels | Clear — info/overflow/drag controls all labelled. |

## Anti-patterns (§12)

No regressions. Gradients, glass, card-soup, KPI dashboards, rings/gauges, streaks/scolding,
red over-target, pie/donut, placeholder-only labels, non-tabular data figures, drag-only
interactions and sub-16px body copy were each checked and found clear.
