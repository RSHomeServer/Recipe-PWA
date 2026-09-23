# UX critique — step 12

Pass against [DESIGN.md](./DESIGN.md) §§1–12 and accessibility §9 after Insights (PR #12). Branch: `feature/ux-critique`.

## Summary verdict

The product largely follows the warm paper-and-earth direction: flat surfaces, Fraunces for display, herb-green accent, bars (not pies/rings), PlanSlotTile cook vs portion distinction, TargetReadout as plain figures, and empty-state copy aligned with §11. No purple gradients, glass, KPI tile dashboards, or calorie rings were found.

The remaining gaps are polish and a11y consistency rather than a wrong product direction. Clear violations found in this pass were fixed on this branch; judgment calls and broader audits are listed below as deferred.

## Fixed in this PR

- **Insights MacroBar** — segments used raw macro grams while the legend appended `%` (misleading). Now uses Atwater energy share, matching the recipe nutrition panel.
- **AvailabilityIndicator** — colour + text only; now includes Check / AlertTriangle / CircleDashed icons per §3 / §9 (never colour alone).
- **Touch targets** — pantry ± steppers to 48px; plan drag/remove and log edit/delete to 44px; plan “Move to…” select restored to default `h-11`; button `sm` height raised to 44px; shopping group toggles `min-h-11`.
- **Focus-visible** — bottom tab and sidebar nav links get an explicit focus ring (`--color-focus-ring`).
- **Live regions** — Log day kcal total (`aria-live="polite"`); Shopping “N items left to buy” while ticking.
- **Button label size** — default button text uses `text-base` (16px floor).

## Remaining / deferred

| Severity | Issue | Notes |
| --- | --- | --- |
| should-fix | Macro colour AA as text/legend in both themes | Hex values in DESIGN §3 are still provisional; verify rust/amber/slate/none against `--color-surface` and tune DESIGN.md tokens if needed — do not patch hex in components. |
| should-fix | Loading skeletons | `RouteStatePanel` uses plain muted blocks, not PWA-Base `Skeleton`, and has no ~150ms delay (§11). Fine for IndexedDB speed; polish later. |
| should-fix | Some icon-only / compact controls still dense on desktop plan grid | Drag handles meet 44px; week grid remains tight on small tablets — revisit if planner density feedback arrives. |
| nit | `text-sm` still used for metadata, hints, and form labels | DESIGN allows sm for secondary/metadata and xs for labels/badges; body content should stay ≥16px. Spot-check remaining `text-sm` body copy if any slips through. |
| nit | Charts are `aria-hidden` with table equivalents | Acceptable per §8 rule 4; ensure every new chart keeps a DOM table. |
| nit | Today page is thin | Intentional stub after Insights; not a DESIGN anti-pattern. |
| nit | IngredientChip `min-h-8` | Chip is presentational, not a primary control; OK unless made interactive. |
| blocker | *(none deferred)* | — |

## Route-by-route notes

| Route | Notes |
| --- | --- |
| `/` Today | TargetReadout when set; no nag when unset. Sparse otherwise. |
| `/ingredients` | List + empty copy matches §11. |
| `/recipes` | List/monogram image rule looks correct; Fraunces titles. |
| `/pantry` | Negative stock plain + “Set to 0”; availability icons fixed. |
| `/cook` | Batch cards as separable objects — OK for cards. |
| `/plan` | Cook vs portion tiles distinct; keyboard Move to… present; targets enlarged. |
| `/shopping` | Window control + carry-over prompt; tick targets 48px; live remaining count. |
| `/log` | PlanSlotTile reuse; day total live region; empty copy matches §11. |
| `/insights` | Question sections; bars + tables; MacroBar % fix; TargetReadout. |
| `/settings` | Optional target form; ThemeToggle. |

## Anti-patterns (§12) checklist

| Forbidden | Status |
| --- | --- |
| Purple/blue gradients / gradient fills | Clear |
| Glass / blur / translucent panels | Clear |
| Card soup | Largely lists; cards for batches/tiles only |
| KPI dashboard tiles | Clear |
| Rings / gauges / scoreboard | Clear (TargetReadout + slim meter only) |
| Streaks / scolding / red over-target | Clear (over = plain ink) |
| Pie / donut | Clear |
| Placeholder-only labels | Forms use visible labels |
| Non-tabular figures in data | `.num` used on quantities/kcal |
| Drag-only planner | Move to… select present |

## Accessibility §9 quick status

1. Contrast — deferred verification (should-fix above).  
2. Never colour alone — availability fixed; macros have labels.  
3. Body ≥16px — buttons raised; watch remaining sm body copy.  
4. Focus-visible — forms/buttons OK; nav links fixed.  
5. Planner keyboard — Move to… present.  
6. Semantics — main via shell; tables on Insights.  
7. Live regions — Log + Shopping added.  
8. Reduced motion — relies on PWA-Base tokens.  
9. Touch ≥44px / 48px steppers-ticks — fixed hotspots.  
10. Icon-only labels — present on checked controls.  
