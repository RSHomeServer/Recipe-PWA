# Architecture

Proposed application architecture for Recipe PWA: where code lives, how domain logic stays
independently testable, how data is persisted, and how the mandated UI stack reconciles with
`@songara/pwa-base`.

Companions: [DOMAIN_MODEL.md](./DOMAIN_MODEL.md), [NUTRITION_MODEL.md](./NUTRITION_MODEL.md),
[UNIT_MODEL.md](./UNIT_MODEL.md), [DESIGN.md](./DESIGN.md),
[OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md).

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
  batches/     Batch + snapshot creation, portion maths
  pantry/       Stock movement ledger, derived quantities, availability
  planning/    PlannedMeal schema, plan requirements aggregation
  shopping/    requirements − pantry, grouping, provenance
  logging/     LoggedMeal schema, entry resolution
  insights/    expand() → Contribution[], folds for every insight
```

Every module is plain functions over plain data. `insights` depends on `logging`, `batches`,
`recipes`, `nutrition`, `units` — all pure — so the whole of "where did my calories come
from?" is exercisable in a Node test with hand-written fixtures and no browser.

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

- The data is relational-ish and unbounded (years of movements and logs). `localStorage`
  caps at ~5 MB, is synchronous, and is string-only — unusable here.
- Dexie gives indexed queries (`logs by date`, `movements by ingredient`) which the insights
  and pantry views need, plus a declarative migration story.
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
| `recipes` | `id` | `name`, `archivedAt` |
| `batches` | `id` | `recipeId`, `cookedAt` |
| `stockMovements` | `id` | `ingredientId`, `at`, `[ingredientId+at]` |
| `plannedMeals` | `id` | `date`, `[date+slot]` |
| `loggedMeals` | `id` | `date`, `[date+slot]`, `plannedMealId` |
| `shoppingOverlays` | `id` | `windowKey` |

No derived data is persisted. There is no `pantryItems` table, no `shoppingLists` table, no
insights rollup — by design.

Schema evolution uses `applySchemaVersions`; each version is append-only and never edited
after release. Because reads `parse()` through Zod, a migration that produces a shape the
current code cannot handle fails loudly at the boundary instead of corrupting a calculation.

**Backup:** export/import the whole database as a single validated JSON document. With no
server and no sync, this is the only way a user can protect or move their data, so it is v1
scope, not a nicety. It is also the fastest way to seed realistic fixtures during
development.

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
  const recipes   = useLiveQuery(() => repos.recipes.all(), []);
  const movements = useLiveQuery(() => repos.movements.all(), []);
  const ingredients = useLiveQuery(() => repos.ingredients.all(), []);
  return useMemo(
    () => (recipes && movements && ingredients)
      ? availabilityForAll(recipes, pantryFrom(movements), ingredients)   // pure domain
      : undefined,
    [recipes, movements, ingredients],
  );
}
```

The React layer fetches and memoises; the domain layer decides. `availabilityForAll` and
`pantryFrom` are tested directly with arrays.

`dexie-react-hooks` is app-local, not a PWA-Base export. It is small and purpose-built for
the store we chose. If a second Songara app adopts the same pattern it becomes a candidate
for a Preview graduation note (ADR-008 §5, ADR-003 two-consumer rule) — worth recording then,
not now.

**Scale check:** `movements.all()` grows without bound. At personal scale (thousands of rows)
full scans are microseconds and correctness beats cleverness. When a view gets slow the fix
is a narrowed index-backed query (`[ingredientId+at]`, `[date+slot]`) or a date-windowed
insights query — not a cached aggregate table. Windowed queries for insights should be in
from the start since the range is always known.

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
visual tone of every dense screen, shadcn/ui should own the whole interactive layer. This is
flagged for human confirmation as [Q9](./OPEN_QUESTIONS.md) with this recommendation as the
default so implementation is not blocked.

Non-negotiable regardless of that answer: **shadcn's CSS variables are aliased to PWA-Base
tokens; they never define their own colour values.** One token source, no drift.

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
list rows, and `Gauge` may suit a single progress readout if targets are ever added.

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

## Routing and shell

`defineSite` + `SoloSiteApp` with `nav` omitted (solo app, no catalogue mega-bar), inside
`ThemeProvider` and `BrowserRouter`, per `consuming-pwa-base.md`.

| Route | Purpose |
| --- | --- |
| `/` | Today: what to eat, quick-log, plan for today |
| `/ingredients`, `/ingredients/:id` | Library, editor |
| `/recipes`, `/recipes/:id` | Library with availability, editor, breakdown |
| `/pantry` | Stock, quick adjust, movement history |
| `/cook` | Batches: cook a recipe, portions remaining |
| `/plan` | Week grid, day × slot |
| `/shopping` | Derived list, aisle/recipe grouping |
| `/log` | Diary by day |
| `/insights` | Totals and attribution |
| `/settings` | Theme, export/import, categories |

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
| **2. Repository** | Vitest + `fake-indexeddb` | `data/` CRUD and migrations | Round-trip each entity; migration from vN to vN+1 preserves data; Zod parse-on-read rejects malformed rows. (`fake-indexeddb` is already the pattern in PWA-Base's `preview-dexie`.) |
| **3. Component** | Vitest + jsdom + Testing Library | Forms, entry flows | Deliberately selective: ingredient form validation, portion logging (including 0.5), unit entry with a missing conversion factor, keyboard path for the planner. Not blanket component tests. |
| **4. Smoke** | Playwright | Boot, navigate, create ingredient → recipe → log | One happy path per release, not a regression net. |

Scripts to add: `test` (Vitest run), `test:watch`, `test:coverage`, `typecheck`
(`tsc -b --noEmit`). `lint` already exists.

The tests that matter most, called out so they are not skipped:

1. **History immutability** — edit a recipe and an ingredient's nutrition; assert every
   existing `Batch.snapshot` and every insight derived from `batchPortions` logs is
   byte-identical (NUTRITION_MODEL.md property 6).
2. **Insights reconciliation** — `Σ by-slot = Σ by-recipe = Σ by-ingredient (+ unattributed)
   = Σ daily` over a generated month (property 7).
3. **Shopping arithmetic** — the brief's worked example (chicken 2.5 kg required, 1.2 kg in
   pantry → 1.3 kg to buy), plus planned `batchPortions` contributing **nothing**.
4. **Pantry ledger** — derived quantity equals the movement sum after an arbitrary sequence;
   negative stock is surfaced, not clamped.
5. **Unit refusal** — a cross-kind entry with no density returns `ok: false` and never a
   fabricated number.

## Decisions summary

| Decision | Choice | Why |
| --- | --- | --- |
| Layering | `domain` → `data` → `features` → `app`, ESLint-enforced | Calculations testable with zero UI or storage |
| Type source of truth | Zod schemas, types inferred | One definition serving forms, storage reads, and imports |
| Persistence | Dexie via `@songara/pwa-base/preview/dexie` | Indexed, migratable, offline; ADR-008 sanctioned channel |
| Derived data | Never persisted | Eliminates staleness; the brief's core principle |
| Pantry | Append-only movement ledger; quantity derived | No duplicated state; explains itself |
| Reactive state | `useLiveQuery`, no global store | Database is the only copy of state |
| Tokens & theme | PWA-Base `tokens.css` + `ThemeProvider`; shadcn aliased to it | One token source, platform consistency |
| Components | shadcn/ui interactive layer; PWA-Base display primitives ([Q9](./OPEN_QUESTIONS.md)) | Visual coherence; PWA-Base defers what we need most |
| Charts | Recharts | PWA-Base charts are lab-shaped, not nutrition-shaped |
| Shell | `defineSite` + `SoloSiteApp`, `nav` omitted | Documented consumer path; solo app |
| Backup | JSON export/import, v1 | Only data-protection route without a server |

## Suggested implementation sequence

Each step is an Executor-sized ticket, ordered so nothing is built on an unsettled
foundation. Steps 1–2 depend on the [open questions](./OPEN_QUESTIONS.md) being answered.

1. **UI foundation** — dependencies, Tailwind + shadcn wired to PWA-Base tokens,
   `defineSite`/`SoloSiteApp` shell, routes, `vite-plugin-pwa`, Vitest, starter cleanup.
   Implements [DESIGN.md](./DESIGN.md).
2. **Domain core** — `units` + `nutrition` with their full property test suites. No UI.
3. **Persistence** — Dexie schema v1, repositories, in-memory doubles, export/import.
4. **Ingredients** — library CRUD, RHF+Zod forms, categories, staple flag.
5. **Recipes** — editor, derived nutrition, ingredient breakdown, scaling.
6. **Pantry** — movement ledger, quick adjust, three-state availability on recipes.
7. **Meal plan** — week grid, dnd-kit plus accessible fallback, requirement aggregation.
8. **Shopping** — derived list, aisle/recipe grouping, tick → `purchase` movement.
9. **Batches & logging** — cook flow with editable actual quantities, snapshot freeze,
   portion tracking, one-tap log-from-plan, fractional portions, quick-add.
10. **Insights** — `expand()` folds, Recharts views, attribution by slot/recipe/ingredient.
11. **UX and visual critique** — against DESIGN.md, with the a11y checklist.
