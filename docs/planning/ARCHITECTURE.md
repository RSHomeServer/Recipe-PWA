# Architecture

Proposed application architecture for Recipe PWA: where code lives, how domain logic stays
independently testable, how data is persisted, and how the mandated UI stack reconciles with
`@songara/pwa-base`.

Companions: [DOMAIN_MODEL.md](./DOMAIN_MODEL.md), [NUTRITION_MODEL.md](./NUTRITION_MODEL.md),
[UNIT_MODEL.md](./UNIT_MODEL.md), [DESIGN.md](./DESIGN.md),
[OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md).

> **V2.** The architecture below is unchanged — same layering, same persistence, same reactive
> model, same UI stack. V2 adds one table, three fields and a Dexie schema version; see
> [Schema version 2](#schema-version-2-v2) and [V2_SCOPE.md](./V2_SCOPE.md) for the ticket
> sequence. That nothing structural moves is the intended outcome, not a coincidence: the
> layering exists so that a feature like meal templates is a table and a component, not a
> refactor.

## Repo inspection findings

Inspected at planning time: `Recipe-PWA/` (branch `feature/recipe-pwa-orchnestr-jv8`, single
commit "Initial caddy/vite setup") and the attached `PWA-Base/` worktree.

### Recipe-PWA as it stands

| Aspect | Current state |
| --- | --- |
| Stack | React 19.2, Vite 8.2, TypeScript 6.0, ESLint 10 (flat config) |
| Dependencies | `react`, `react-dom`, `@songara/pwa-base` (`file:../PWA-Base`) — nothing else |
| Application code | Untouched Vite starter: `src/App.tsx` is the logo + counter template |
| Scripts | `dev`, `build`, `lint`, `preview` |
| Vite config | `react()` plugin only; `port: 5305`, `strictPort`, `allowedHosts: ['.dev.songara.uk']` |
| `index.html` | Default template; title `recipe-pwa`, no manifest link, no theme colour |

The infrastructure the brief tells us not to redesign is correct and should be left alone:
the port, `strictPort`, and `allowedHosts` match the Caddy → Vite → app path at
`https://recipe.dev.songara.uk`.

### Gaps between current state and what the product needs

| Gap | Consequence | Resolution |
| --- | --- | --- |
| `@songara/pwa-base` is declared but **never imported** | No tokens, no theme, no site contract, no runtime | Import `ui/tokens.css`, `ThemeProvider`, `defineSite`, `SoloSiteApp` in the UI-foundation ticket |
| No router; `react-router-dom` absent | `SoloSiteApp` declares it as a **peer** — required, not optional | Add `react-router-dom` ^7.6 |
| No styling system | Product brief mandates Tailwind + shadcn/ui | Tailwind v4 + shadcn/ui at app level — see reconciliation below |
| No test runner, no `test`/`typecheck` scripts | The calculation-heavy core the brief calls out cannot be verified | Add Vitest + scripts; domain tests from the first domain ticket |
| No persistence | Nothing survives a refresh | Dexie via `@songara/pwa-base/preview/dexie` |
| No form library | Brief mandates RHF + Zod | Add `react-hook-form`, `zod`, `@hookform/resolvers` |
| Not actually a PWA — no manifest, no service worker | Cannot install, no offline | `vite-plugin-pwa`, following `apps/hello-web`'s config as the reference |
| `appVersionPlugin` unused | No build identity | Add `@songara/pwa-base/config/vite-app-version` |
| Starter assets and template `App.css` | Dead weight | Delete in the UI-foundation ticket |

None of this is a defect — the repo is a clean starting point. The point of the table is that
the UI-foundation ticket has a precise, finite list.

### PWA-Base surface actually available to us

Verified against the package `exports` map and `docs/guides/consuming-pwa-base.md`:

- **Site contract** — `defineSite`, `SITE_CAPABILITY` (`@songara/pwa-base/contract`)
- **Runtime** — `SoloSiteApp`, `PlatformChrome`, `PackReadyGate`/`useAppReady`, connectivity
  and service-worker update UX, platform preferences. Solo apps default to no mega-bar
  (`nav` omitted or `null`) — correct for us.
- **UI** — tokens stylesheet, `ThemeProvider`/`useTheme`/`ThemeToggle`, and 18 primitives:
  `Button`, `IconButton`, `Link`, `Stack`, `Divider`, `Surface`, `Panel`, `Label`,
  `TextField`, `Select`, `TextArea`, `Badge`, `Spinner`, `Skeleton`, `EmptyState`, `Kbd`.
  Styled with **CSS Modules over CSS custom properties** — not Tailwind.
- **Deliberately absent** from `@platform/ui` (documented as deferred): Checkbox, Radio,
  Switch, Modal/Dialog, Toast, Tooltip, Table, Tabs, Accordion, form-field wrapper, grid,
  icon set. All of which this product needs.
- **Charts** — `Sparkline`, `Gauge`, `AnalysisChart`. `AnalysisChart` accepts only
  `{ kind: "groups" }` (mean/stdev bars) or `{ kind: "scatter" }`: lab/statistics shapes.
  There is no stacked bar, no donut, no time series.
- **Preview (ADR-008, opt-in, peer-installed)** — `preview/dexie`, `preview/idb`,
  `preview/localforage`, `preview/motion`, plus animation/physics wrappers.
- **Config** — `vite-app-version` plugin, shared tsconfig baselines.
- **Reference app** — `apps/hello-web` shows the `vite-plugin-pwa` + `appVersionPlugin` +
  `SoloSiteApp` wiring to copy.

Two findings drive decisions below: PWA-Base's component set stops well short of what a
data-entry-heavy product needs, and its charts are the wrong shape for nutrition.

## Layered architecture

Four layers, strictly one-directional. The rule that matters: **`domain/` imports nothing
from the three layers above it, and nothing from any storage or React package.**

```
src/
  domain/        Pure TypeScript. Zod schemas, types, all calculations.
                 No React. No Dexie. No DOM. No I/O.
  data/          Repository interfaces + Dexie implementations. Schema versions.
                 Imports domain types only.
  features/      React per area: components, hooks, forms, routes.
                 Imports domain (pure fns) + data (via hooks).
  app/           Shell: site definition, routes, providers, theme, layout.
  ui/            App-local presentational components and shadcn/ui primitives.
```

```
app ──> features ──> data ──> domain
         │                      ▲
         └──────────────────────┘   (features call domain functions directly)
```

Enforced by an ESLint `no-restricted-imports` boundary rule, not by convention alone —
otherwise the first deadline pressure puts a Dexie call inside a calculation.

### `domain/` — the calculation core

```
domain/
  units/       Unit table, toCanonical, formatting, comparison + EPSILON
  nutrition/   Nutrition, scale, sum, nutritionOf, recipe totals, breakdown
  ingredients/ Ingredient schema, validation
  recipes/     Recipe schema, scaling, per-serving
  batches/     Snapshot creation, portion maths, availability and closure predicates
  pantry/      Stock arithmetic (add/remove/set), availability classification
  planning/    PlannedMeal schema, plan requirements aggregation
  shopping/    requirements − pantry, grouping, provenance
  logging/     LoggedMeal schema, entry resolution
  insights/    expand() → Contribution[], folds for every insight
```

Every module is plain functions over plain data. `insights` depends on `logging`, `batches`,
`recipes`, `nutrition`, `units` — all pure — so the whole of "where did my calories come
from?" is exercisable in a Node test with hand-written fixtures and no browser. Batch
attribution reads the frozen snapshot, so it needs no recipe or ingredient lookup at all, which
makes the insights fixtures notably simpler.

**Zod schemas are the single source of truth for types.** Types are inferred
(`type Recipe = z.infer<typeof RecipeSchema>`), never hand-written alongside a schema, so
they cannot drift. The same schemas serve three jobs: RHF validation via
`@hookform/resolvers/zod`, parse-on-read from IndexedDB (which catches migration bugs and
hand-edited data), and validation of imported backup JSON.

### `data/` — repositories over Dexie

```ts
interface RecipeRepo {
  all(): Promise<Recipe[]>;
  byId(id: Id): Promise<Recipe | undefined>;
  put(r: Recipe): Promise<void>;
  archive(id: Id): Promise<void>;
}
```

Two implementations: Dexie-backed for the app, and in-memory for tests. Repositories do
CRUD and nothing else — **no calculation ever lives in `data/`**. Every derived value in
DOMAIN_MODEL.md (pantry quantities, availability, requirements, shopping lines, insights) is
computed by a `domain/` function taking plain arrays as input. That is precisely what makes
the interesting logic testable without a database.

## Persistence

**Decision: IndexedDB via Dexie, consumed through
`@songara/pwa-base/preview/dexie`** (peer: `dexie` ^4).

Rationale:

- The data is relational-ish and unbounded (years of logs), and recipe images are Blobs.
  `localStorage` caps at ~5 MB, is synchronous, and is string-only — unusable here.
- Dexie gives indexed queries (`logs by date`, `batches by recipe`) which the insights and
  batch views need, plus a declarative migration story and native Blob storage.
- Going through the PWA-Base Preview channel is the sanctioned route under ADR-008: it
  re-exports Dexie's own surface plus Songara naming (`songaraDbName`) and migration helpers
  (`applySchemaVersions`), so we standardise with the platform instead of forking a wrapper.
  Preview APIs may break — an accepted trade-off, isolated behind `data/` where exactly one
  module imports it.
- Rejected: `preview/idb` (lower level, no query builder — we would rebuild Dexie badly);
  `preview/localforage` (a key-value store; no indexes); a remote API (no backend, and
  offline-first is a deliberate differentiator).

Store layout — one table per stored entity, mirroring DOMAIN_MODEL.md exactly:

| Table | Primary key | Indexes |
| --- | --- | --- |
| `ingredients` | `id` | `name`, `categoryId`, `archivedAt` |
| `ingredientCategories` | `id` | `sortOrder` |
| `recipes` | `id` | `name`, `archivedAt` |
| `recipeImages` | `id` | — (Blob payload, fetched only on the recipe page) |
| `batches` | `id` | `recipeId`, `cookedAt`, `closedAt` (row carries the immutable `snapshot`) |
| `pantryStock` | `ingredientId` | `updatedAt` |
| `mealSlots` | `id` | `sortOrder` |
| `plannedMeals` | `id` | `date`, `[date+slotId]` |
| `loggedMeals` | `id` | `date`, `[date+slotId]`, `plannedMealId` |
| `shoppingOverlays` | `id` | `windowKey` |
| `settings` | `id` (`"singleton"`) | — |

No derived data is persisted. There is no shopping-list table, no portions-remaining counter
and no insights rollup — by design (decision 23).

Three shape notes:

- **`batches` rows embed an immutable `snapshot`** — recipe name, ingredient lines with actual
  quantities and their nutrition, and the total. It is the only nutritional source for a batch
  and is the one place in the schema where a write must be rejected rather than applied:
  `update()` on an existing batch must not touch `snapshot`. Enforce it in the repository, not
  only by convention, and cover it with a test — a well-meaning "recalculate batches" migration
  is precisely the mistake this design exists to prevent.
- **`pantryStock` is keyed by `ingredientId`, one row per ingredient**, holding the current
  quantity. Decision 10 makes the pantry a practical planning aid rather than an accounting
  system, so there is no movement ledger and no lots — see the reversal note below.
- **`mealSlots` is a table, not an enum.** Decision 14 requires that nothing be hard-coded
  around a fixed number of meals per day, so the four defaults are seeded rows.

Schema evolution uses `applySchemaVersions`; each version is append-only and never edited
after release. Because reads `parse()` through Zod, a migration that produces a shape the
current code cannot handle fails loudly at the boundary instead of corrupting a calculation.

### Schema version 2 (V2)

Per [ADR-002](../adr/002-reference-ingredient-data-and-provenance.md) and
[ADR-004](../adr/004-meal-templates-by-expansion.md). Version 1 is never edited.

| Table | Change | Migration |
| --- | --- | --- |
| `mealTemplates` | **New.** PK `id`, indexes `name`, `archivedAt` | Empty |
| `ingredients` | `+ source` (non-null), `+ imageId` | `source = { kind: "userEntered", origin fields null }`, `imageId = null` |
| `ingredientCategories` | `+ icon`, `+ accent` | Seeded categories get documented values; user-created get a neutral default |
| `plannedMeals` | `+ group`, new index `group.id` | `group = null` |
| `loggedMeals` | `+ group`, new index `group.id` | `group = null` |
| `settings` | `+ controlStyle`, `+ howItWorksDismissed`, `+ starterPackVersion` | Via the existing `normalizeSettingsRow` pattern |

Three implementation notes.

**Dexie indexes nested key paths**, so `group.id` is a valid index string and needs no
denormalised column.

**Ingredient photos reuse the existing `recipeImages` table.** The name is now historical.
Renaming it would mean copying Blob rows in an `upgrade()` for no functional gain, and
migrating binary data is a worse trade than a slightly stale table name. Record that
reasoning in the schema file so a later tidy-up does not undo the judgement.

**`Backup.formatVersion` stays 1** — the envelope shape is unchanged — while
`Backup.schemaVersion` becomes 2. Export must include `mealTemplates`; import must accept a
v1 payload and run the normal migrations, and must still refuse a payload from a newer
version. The existing round-trip test extends rather than changes.

Two repository rules extend the existing write-once enforcement on `Batch.snapshot`:
`IngredientSource`'s origin fields may not be mutated once set, and the starter-pack seed is
additive-only, matched by `source.entryCode`, never overwriting an edited row.

### Backup: JSON export and import (V1)

With no server and no sync (decision 24), this is the primary backup and migration mechanism,
so it ships in V1 alongside the schema.

```ts
type Backup = {
  formatVersion: 1;
  schemaVersion: number;          // the Dexie version the export came from
  exportedAt: IsoDateTime;
  data: { [table: string]: unknown[] };   // every table, including images
};
```

**Export** writes all application data in a schema-valid representation. Recipe images are
included as **base64-encoded strings inside the JSON** — no ZIP unless file size becomes a
demonstrated problem, which for a personal recipe library it likely never will.

**Import** validates the complete payload through the **same Zod schemas** the repositories
use, then replaces the database contents: **all-or-nothing, into a clean database, inside a
single Dexie transaction**. Nothing is written unless the whole payload parses. **No merge
import** — without multi-device sync it would add conflict resolution for no benefit, so
"import" always means "replace", stated plainly in the confirmation dialog.

Two implementation notes. Base64 inflates images by about a third and `JSON.stringify` on the
whole database is synchronous, so both directions should stream or chunk if a large library
makes the main thread stutter — measure before optimising. And an import from a **newer**
`schemaVersion` than the running app must be refused with a clear message rather than
partially applied; an older one runs the normal migrations.

This is also the fastest way to seed realistic development fixtures.

### Pantry: stored quantity, not a ledger

Earlier planning proposed an append-only movement ledger with the current quantity derived
from it, on the grounds that it avoids duplicated state and can explain its own history.
Decision 10 settles it the other way: the pantry is "a practical planning aid, not an
accounting system", with lots, FIFO, waste tracking and expiry all explicitly excluded, and
the decision's own worked examples describe a quantity being mutated (500 g + 1 kg = 1.5 kg;
2 L − 350 ml = 1650 ml).

So `PantryStock.quantity` is the source of truth and is updated in place. This is not the
duplication decision 23 warns against — that rule targets *analytical* data (recipe nutrition,
shopping requirements, insights), all of which remain derived. The pantry's current quantity is
not recomputable from anything else, so it is primary state rather than a cached aggregate.

The cost, stated plainly: the pantry cannot answer "where did my stock go?", and an
accidental adjustment is not recoverable. That history is the accounting behaviour decision 10
rules out. If it is ever wanted, an append-only audit log can be added *alongside* the stored
quantity — as history, never as the source of truth.

## Reactive state

**Decision: `useLiveQuery` from `dexie-react-hooks`, plus React local state. No global store,
no server-state cache.**

`useLiveQuery` subscribes a component to an IndexedDB query and re-renders when the
underlying tables change. Combined with the "derive everything" model this means there is
exactly one copy of every value: the database. There is no cache to invalidate, no store to
keep in step, no stale shopping list. Tick a shopping item and the pantry list, the recipe
availability badges, and the shopping total all update because they are all queries over the
same tables.

Rejected: Redux/Zustand (a second copy of state to synchronise — the exact duplication the
brief warns against); TanStack Query (excellent for a network cache, but there is no network
and it would add a cache layer over a local database); raw `useEffect` + `useState` per view
(hand-rolled invalidation, guaranteed staleness bugs).

Pattern — hooks live in `features/`, wrap a repo query and a domain function:

```ts
export function useRecipeAvailability() {
  const recipes     = useLiveQuery(() => repos.recipes.all(), []);
  const stock       = useLiveQuery(() => repos.pantry.all(), []);
  const ingredients = useLiveQuery(() => repos.ingredients.all(), []);
  return useMemo(
    () => (recipes && stock && ingredients)
      ? availabilityForAll(recipes, stock, ingredients)   // pure domain
      : undefined,
    [recipes, stock, ingredients],
  );
}
```

The React layer fetches and memoises; the domain layer decides. `availabilityForAll` is tested
directly with arrays.

`dexie-react-hooks` is app-local, not a PWA-Base export. It is small and purpose-built for
the store we chose. If a second Songara app adopts the same pattern it becomes a candidate
for a Preview graduation note (ADR-008 §5, ADR-003 two-consumer rule) — worth recording then,
not now.

**Scale check:** `loggedMeals` and `batches` grow without bound. At personal scale (thousands
of rows) full scans are microseconds and correctness beats cleverness. When a view gets slow
the fix is a narrowed index-backed query (`[date+slotId]`, `recipeId`) or a date-windowed
insights query — not a cached aggregate table. Windowed queries for insights should be in from
the start, since the range is always known. `recipeImages` is a separate table precisely so
that listing recipes never pulls Blobs into memory.

## UI stack — reconciling the brief with PWA-Base

The product brief mandates shadcn/ui + Tailwind. PWA-Base ships CSS-Module primitives over
CSS-variable tokens. This is the one real architectural tension in the project, and
PWA-Base's own design-system doc resolves the licence question: under "What we deliberately
avoid" it lists *"Tailwind in `@platform/ui` — sites may choose their own styling
approach."* Tailwind at app level is explicitly sanctioned. What still needs deciding is who
owns which layer.

### Decision: PWA-Base owns the platform, shadcn/ui owns the component layer, and there is one token source

| Concern | Owner |
| --- | --- |
| Design tokens (colour, type, space, radius, motion, z-index) | **PWA-Base** `ui/tokens.css` — the single source of truth |
| Light/dark theming and persistence | **PWA-Base** `ThemeProvider` (`data-theme` + `.theme-*` on `<html>`) |
| App shell, routing contract, PWA/service-worker UX, preferences | **PWA-Base** `defineSite` + `SoloSiteApp` |
| Interactive components (dialog, sheet, popover, command, tabs, table, toast, checkbox, radio, switch, combobox, calendar, dropdown, tooltip, accordion) | **shadcn/ui** (Radix underneath) |
| Buttons, inputs, selects, badges | **shadcn/ui**, for visual consistency with the above |
| Non-interactive display primitives: `EmptyState`, `Skeleton`, `Spinner`, `Stack`, `Divider` | **PWA-Base** — real value, no visual conflict |
| Nutrition charts | **Recharts** |
| Icons | **Lucide** |
| Domain components (RecipeCard, MacroBar, PortionStepper, PlanSlot) | **App-local**, composing the above |

The judgement call is buttons and inputs. Sourcing them from both libraries would mean two
button styles, two focus treatments and two disabled states in one product — the fastest
route to a UI that looks assembled rather than designed. Since shadcn/ui must supply the
dialogs, tables, comboboxes and toasts that PWA-Base deliberately defers, and those set the
visual tone of every dense screen, shadcn/ui owns the whole interactive layer. Decision 25
confirms this: shadcn/ui and the specified toolbox, with no second UI framework introduced.

Non-negotiable: **shadcn's CSS variables are aliased to PWA-Base tokens; they never define
their own colour values.** One token source, no drift.

```css
/* src/app/styles.css */
@import "@songara/pwa-base/ui/tokens.css";   /* tokens first — the source of truth */
@import "tailwindcss";

/* Follow PWA-Base's ThemeProvider instead of shadcn's default .dark class */
@custom-variant dark (&:is([data-theme="dark"] *));

/* Recipe PWA identity: override PWA-Base semantic tokens, never invent parallel ones */
:root {
  --color-accent: …;            /* herb green — see DESIGN.md */
  --color-accent-hover: …;
  --font-family-display: "Fraunces", Georgia, serif;
}

/* shadcn's contract, mapped onto PWA-Base tokens */
@theme inline {
  --color-background:    var(--color-background);
  --color-foreground:    var(--color-foreground);
  --color-card:          var(--color-surface);
  --color-primary:       var(--color-primary);
  --color-muted:         var(--color-muted-background);
  --color-border:        var(--color-border);
  --color-ring:          var(--color-focus-ring);
  --radius-lg:           var(--radius-lg);
  --font-sans:           var(--font-family-sans);
  /* … full map in the UI-foundation ticket */
}
```

Tailwind v4 is CSS-first (no `tailwind.config.js`), `components.json` sets
`tailwind.cssVariables: true`, and the `@custom-variant dark` override is the line that makes
PWA-Base's `ThemeProvider` drive shadcn's dark mode. Concrete token values are DESIGN.md's
job, not this document's.

### Charts: Recharts, with evidence

PWA-Base's `AnalysisChart` accepts `{ kind: "groups" }` (mean ± stdev bars) or
`{ kind: "scatter" }` — a statistics-lab API. Nutrition needs stacked macro bars, a
day/week time series, and a composition breakdown by ingredient. Bending a scatter/groups
API into those shapes would be worse than adopting the library the brief already names.
Recharts owns the Insights charts; PWA-Base's `Sparkline` is a good fit for inline trends in
list rows. PWA-Base's `Gauge` is deliberately **not** used for the optional calorie target
(decision 20) — [DESIGN.md](./DESIGN.md) specifies a restrained linear meter instead, because a
dial is the progress-ring framing decision 25 rules out.

### Other mandated dependencies

`react-hook-form` + `zod` + `@hookform/resolvers` for every form, reusing the domain schemas.
`dnd-kit` **only** for the meal-planner grid, and always with an accessible non-drag
alternative ("move to…" menu) — drag-only interactions are inaccessible and unusable on a
phone. `motion` via `@songara/pwa-base/preview/motion`, which is reduced-motion aware by
default, rather than the raw package.

Full dependency list for the UI-foundation ticket: `react-router-dom`, `tailwindcss`,
`@tailwindcss/vite`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`,
`react-hook-form`, `zod`, `@hookform/resolvers`, `recharts`, `dexie`, `dexie-react-hooks`,
`@dnd-kit/*`, `motion`, `vite-plugin-pwa`, plus dev: `vitest`, `@vitest/coverage-v8`,
`fake-indexeddb`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`.
**Nothing is added during this planning ticket.**

Recipe images (decision 4) need **no dependency**: pick a file, resize on a `<canvas>`, store
the resulting Blob. Resist an image library for this.

## Routing and shell

`defineSite` + `SoloSiteApp` with `nav` omitted (solo app, no catalogue mega-bar), inside
`ThemeProvider` and `BrowserRouter`, per `consuming-pwa-base.md`.

| Route | Purpose |
| --- | --- |
| `/` | Today: what to eat, quick-log, plan for today |
| `/ingredients`, `/ingredients/:id` | Library, editor |
| `/recipes`, `/recipes/:id` | Library with availability, editor, breakdown |
| `/pantry` | Stock, quick adjust, "what can I make?" |
| `/cook` | Batches: cook a recipe, portions remaining |
| `/plan` | Week grid, day × slot |
| `/shopping` | Derived list, aisle/recipe grouping, adjustments |
| `/log` | Diary by day, fast log |
| `/insights` | Totals and attribution |
| `/settings` | Theme, calorie target, export/import, categories, meal slots |

Route-level code splitting via `React.lazy`, so Recharts and dnd-kit stay out of the initial
bundle for a product whose most common action is logging a meal on a phone.

## PWA and offline

`vite-plugin-pwa` configured as `apps/hello-web` does: `registerType: "prompt"`,
`navigateFallback: "/index.html"`, precache the app shell. Since all data is local, the app
is fully functional offline once installed — no runtime API caching to design. PWA-Base's
service-worker update UX surfaces "a new version is available". `appVersionPlugin()` gives
build identity for support.

## Testing

Tiers, cheapest and most valuable first. The brief's "calculation-heavy logic should be
testable independently" is satisfied by tier 1 alone.

| Tier | Tool | Scope | Standard |
| --- | --- | --- | --- |
| **1. Domain** | Vitest (Node, no DOM) | Everything in `domain/` | Highest coverage in the repo. Property tests from NUTRITION_MODEL.md §Testable properties and UNIT_MODEL.md §Testable properties. Required with every domain ticket. |
| **2. Repository** | Vitest + `fake-indexeddb` | `data/` CRUD, migrations, backup | Round-trip each entity; migration from vN to vN+1 preserves data; Zod parse-on-read rejects malformed rows; batch `snapshot` is immutable; export→import round-trips including image Blobs. (`fake-indexeddb` is already the pattern in PWA-Base's `preview-dexie`.) |
| **3. Component** | Vitest + jsdom + Testing Library | Forms, entry flows | Deliberately selective: ingredient form validation, portion logging (including 0.5), the cook-anyway shortfall warning, keyboard path for the planner. Not blanket component tests. |
| **4. Smoke** | Playwright | Boot, navigate, create ingredient → recipe → log | One happy path per release, not a regression net. |

Scripts to add: `test` (Vitest run), `test:watch`, `test:coverage`, `typecheck`
(`tsc -b --noEmit`). `lint` already exists.

The tests that matter most, called out so they are not skipped:

1. **History immutability — the highest-value test in the repository.** Create a batch, log
   portions from it, then edit the source recipe's quantities and an ingredient's nutrition.
   Assert the batch snapshot, every `expand()` result for those logs, and every insight over
   that period are byte-identical to before the edit. Pair it with a repository test asserting
   that `update()` on a batch cannot modify `snapshot`.
2. **Insights reconciliation** — `Σ by-meal = Σ by-recipe = Σ by-ingredient (+ unattributed)
   = Σ by-day` over a generated month
   ([NUTRITION_MODEL.md](./NUTRITION_MODEL.md) property 8).
3. **Actual quantities are honoured** — cook a recipe calling for 500 g of chicken with 550 g;
   assert the snapshot, its nutrition, and the pantry deduction all reflect 550 g.
4. **Shopping arithmetic** — decision 18's worked example (chicken 2.5 kg required, 1.2 kg in
   pantry → 1.3 kg to buy), aggregating a recipe planned on three separate days **before**
   subtracting pantry, and planned `batchPortions` contributing **nothing**.
5. **Shopping window scoping** — ticks recorded under one `windowKey` are invisible under
   another, and changing the range back restores them.
6. **Recipe attribution** — decision 6's worked example: 1340 kcal total, 335 per serving,
   shares of 45/34/15/7% summing to 100% within rounding.
7. **The two stock systems stay separate** (decision 13) — creating a batch reduces pantry
   stock and nothing else; logging a portion reduces portions remaining and leaves pantry
   stock untouched; logging a bare ingredient reduces pantry stock.
8. **Cook anyway** (decision 12) — creating a batch with insufficient stock succeeds, reports
   the exact shortfall, and leaves the pantry at zero or negative rather than refusing.
9. **Pantry arithmetic** — add, remove and set produce the expected single quantity (500 g +
   1 kg = 1.5 kg; 2 L − 350 ml = 1650 ml; 1000 ml − 200 ml = 800 ml), and negative stock is
   surfaced, not clamped.
10. **Batch exhaustion and reopening** — portions reaching zero removes a batch from available
    food; deleting the log that emptied it makes it available again, while a manually closed
    batch stays closed.
11. **Unit family enforcement** — a cross-family entry returns `ok: false` with
    `reason: "wrongFamily"` and never a fabricated number.
12. **Backup round-trip** — export, wipe, import, and assert the database is equivalent
    including image Blobs; a payload with one invalid row imports **nothing**.

## Decisions summary

| Decision | Choice | Why |
| --- | --- | --- |
| Layering | `domain` → `data` → `features` → `app`, ESLint-enforced | Calculations testable with zero UI or storage |
| Type source of truth | Zod schemas, types inferred | One definition serving forms, storage reads, and imports |
| Persistence | Dexie via `@songara/pwa-base/preview/dexie` | Indexed, migratable, offline; ADR-008 sanctioned channel |
| Derived data | Never persisted (recipe nutrition, availability, requirements, portions remaining, insights) | Eliminates staleness (decision 23) |
| Pantry | **Stored quantity, one row per ingredient — no ledger** | Decision 10: planning aid, not an accounting system |
| Batch | **Immutable snapshot with actual quantities**; write-once | A batch is a past event; history must not move (decision A) |
| Meal slots | A table, not an enum | Decision 14: nothing hard-coded around three meals |
| Units | In-family conversion only; no density or item weights | Decision 2: no ingredient-specific conversion tables |
| Reactive state | `useLiveQuery`, no global store | Database is the only copy of state |
| Tokens & theme | PWA-Base `tokens.css` + `ThemeProvider`; shadcn aliased to it | One token source, platform consistency |
| Components | shadcn/ui interactive layer; PWA-Base display primitives | Decision 25; PWA-Base defers what we need most |
| Charts | Recharts; no gauges or rings | PWA-Base charts are lab-shaped; decision 25 rules out ring framing |
| Shell | `defineSite` + `SoloSiteApp`, `nav` omitted | Documented consumer path; solo app |
| Backup | JSON export/import with base64 images; replace-only | Only data-protection route without a server (decisions 24, E) |

## Suggested implementation sequence

Each step is an Executor-sized ticket, ordered so nothing is built on an unsettled foundation.
**Every step is unblocked** — no decision is outstanding
([OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md)).

| # | Ticket | Scope | Depends on |
| --- | --- | --- | --- |
| 1 | **UI foundation** | Dependencies, Tailwind + shadcn wired to PWA-Base tokens, `defineSite`/`SoloSiteApp` shell, routes, `vite-plugin-pwa`, Vitest, starter cleanup. Implements [DESIGN.md](./DESIGN.md). | — |
| 2 | **Domain core** | `units` + `nutrition` with their full property suites. No UI, no storage. | — |
| 3 | **Persistence** | Dexie schema v1, repositories with parse-on-read, immutable-snapshot enforcement, in-memory doubles, JSON export/import, seeded categories and meal slots. | 2 |
| 4 | **Ingredients** | Library CRUD, RHF+Zod forms, categories, per-100g/ml/item nutrition entry, archive. | 1, 3 |
| 5 | **Recipes** | Editor, derived nutrition, ingredient calorie breakdown, dynamic scaling, optional image upload and resize. | 4 |
| 6 | **Pantry** | Add/remove/adjust stock, negative-stock correction, "what can I make?" three-state availability. | 5 |
| 7 | **Batches & portions** | Cook flow with **editable actual quantities**, snapshot creation, shortfall warning and cook-anyway, pantry deduction, fractional portions remaining, closure. | 6 |
| 8 | **Meal plan** | Week grid over `mealSlots`, dnd-kit plus accessible fallback, requirement aggregation. | 7 |
| 9 | **Shopping** | Window control, aggregate-then-subtract, category and recipe grouping, distinguishable adjustments, tick → pantry. | 8 |
| 10 | **Logging** | Fast log-from-plan, log recipe / batch portion / bare ingredient / custom food, diary by day. | 7 |
| 11 | **Insights & target** | `expand()` folds, Recharts views, attribution by meal/recipe/ingredient, optional calorie target. | 10 |
| 12 | **UX and visual critique** | Against DESIGN.md, with the accessibility checklist. | 11 |

**Steps 1–12 are complete** (PRs #1–#12). The V2 sequence continues from here and is
specified in [V2_SCOPE.md](./V2_SCOPE.md) §Ticket sequence.

Ordering rationale for the two non-obvious choices. **Batches precede the meal plan**, because
decision 12 makes cooking the pantry-consuming event and decision 8's portions are what the
planner schedules — building the planner first would mean building it twice. **Logging is its
own ticket** rather than riding along with batches, because decisions 16 and 17 make it four
entry kinds with a speed requirement of its own, and it is the single most-used screen in the
product.
