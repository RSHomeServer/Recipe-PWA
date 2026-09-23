import type { PantryStock } from "../pantry/schemas";
import type {
  PlanRequirementLine,
  PlanRequirementSource,
} from "../planning/requirements";
import { createId } from "../shared/primitives";
import { isZero } from "../units/compare";
import type { CanonicalQuantity } from "../units/schemas";
import { zeroQuantity } from "../units/sum";
import type { ShoppingOverlay } from "./schemas";

export type ShoppingListLine = {
  ingredientId: string;
  /** Aggregated plan requirements (canonical). */
  required: CanonicalQuantity;
  inPantry: CanonicalQuantity;
  /** Derived max(0, required − inPantry). Never rewritten by adjustments. */
  toBuy: CanonicalQuantity;
  /**
   * Quantity the user intends to buy — adjustment when present, else toBuy.
   * Shown beside toBuy when they differ (decision 19).
   */
  buyQuantity: CanonicalQuantity;
  sources: PlanRequirementSource[];
  checked: boolean;
  isManual: boolean;
  manualEntryId?: string;
  hasAdjustment: boolean;
};

function pantryMap(
  pantry: readonly PantryStock[],
): Map<string, CanonicalQuantity> {
  const map = new Map<string, CanonicalQuantity>();
  for (const row of pantry) {
    map.set(row.ingredientId, row.quantity);
  }
  return map;
}

function floorToBuy(
  required: CanonicalQuantity,
  inPantry: CanonicalQuantity,
): CanonicalQuantity {
  if (required.kind !== inPantry.kind) {
    return { ...required };
  }
  const amount = Math.max(0, required.amount - inPantry.amount);
  return { amount, kind: required.kind };
}

/**
 * Derived shopping list: aggregate requirements − pantry, plus overlay.manual,
 * minus overlay.suppressed, with adjustments overriding display buy qty.
 *
 * The list itself is never persisted (decision 18).
 */
export function shoppingList(
  requirementLines: readonly PlanRequirementLine[],
  pantry: readonly PantryStock[],
  overlay: ShoppingOverlay | null | undefined,
): ShoppingListLine[] {
  const stock = pantryMap(pantry);
  const suppressed = new Set(overlay?.suppressed ?? []);
  const checked = new Set(overlay?.checked ?? []);
  const adjustments = new Map(
    (overlay?.adjustments ?? []).map((a) => [a.ingredientId, a.quantity]),
  );

  const lines: ShoppingListLine[] = [];

  for (const req of requirementLines) {
    if (suppressed.has(req.ingredientId)) continue;

    const inPantry =
      stock.get(req.ingredientId) ?? zeroQuantity(req.quantity.kind);
    const toBuy = floorToBuy(req.quantity, inPantry);
    if (isZero(toBuy.amount, toBuy.kind)) continue;

    const adjustment = adjustments.get(req.ingredientId);
    const hasAdjustment =
      adjustment != null && adjustment.kind === toBuy.kind;

    lines.push({
      ingredientId: req.ingredientId,
      required: req.quantity,
      inPantry,
      toBuy,
      buyQuantity: hasAdjustment ? { ...adjustment! } : { ...toBuy },
      sources: req.sources,
      checked: checked.has(req.ingredientId),
      isManual: false,
      hasAdjustment: Boolean(hasAdjustment),
    });
  }

  for (const manual of overlay?.manual ?? []) {
    if (suppressed.has(manual.ingredientId)) continue;
    // Skip if already present from derived requirements.
    if (lines.some((l) => l.ingredientId === manual.ingredientId)) continue;

    const inPantry =
      stock.get(manual.ingredientId) ?? zeroQuantity(manual.quantity.kind);
    const adjustment = adjustments.get(manual.ingredientId);
    const hasAdjustment =
      adjustment != null && adjustment.kind === manual.quantity.kind;

    lines.push({
      ingredientId: manual.ingredientId,
      required: { ...manual.quantity },
      inPantry,
      toBuy: { ...manual.quantity },
      buyQuantity: hasAdjustment
        ? { ...adjustment! }
        : { ...manual.quantity },
      sources: [],
      checked: checked.has(manual.ingredientId),
      isManual: true,
      manualEntryId: manual.id,
      hasAdjustment: Boolean(hasAdjustment),
    });
  }

  return lines.sort((a, b) => a.ingredientId.localeCompare(b.ingredientId));
}

export function emptyShoppingOverlay(key: string): ShoppingOverlay {
  return {
    id: createId(),
    windowKey: key,
    checked: [],
    suppressed: [],
    adjustments: [],
    manual: [],
  };
}

/** Merge checked ids from a previous window into the target overlay. */
export function carryOverChecked(
  fromOverlay: ShoppingOverlay,
  toOverlay: ShoppingOverlay,
): ShoppingOverlay {
  const checked = [
    ...new Set([...toOverlay.checked, ...fromOverlay.checked]),
  ];
  return { ...toOverlay, checked };
}

export function withChecked(
  overlay: ShoppingOverlay,
  ingredientId: string,
  checked: boolean,
): ShoppingOverlay {
  const set = new Set(overlay.checked);
  if (checked) set.add(ingredientId);
  else set.delete(ingredientId);
  return { ...overlay, checked: [...set] };
}

export function withSuppressed(
  overlay: ShoppingOverlay,
  ingredientId: string,
  suppressed: boolean,
): ShoppingOverlay {
  const set = new Set(overlay.suppressed);
  if (suppressed) set.add(ingredientId);
  else set.delete(ingredientId);
  return { ...overlay, suppressed: [...set] };
}

export function withAdjustment(
  overlay: ShoppingOverlay,
  ingredientId: string,
  quantity: CanonicalQuantity | null,
): ShoppingOverlay {
  const rest = overlay.adjustments.filter(
    (a) => a.ingredientId !== ingredientId,
  );
  if (quantity == null) {
    return { ...overlay, adjustments: rest };
  }
  return {
    ...overlay,
    adjustments: [...rest, { ingredientId, quantity }],
  };
}

export function withManualLine(
  overlay: ShoppingOverlay,
  ingredientId: string,
  quantity: CanonicalQuantity,
): ShoppingOverlay {
  const without = overlay.manual.filter(
    (m) => m.ingredientId !== ingredientId,
  );
  return {
    ...overlay,
    manual: [
      ...without,
      { id: createId(), ingredientId, quantity },
    ],
  };
}

export function withoutManualLine(
  overlay: ShoppingOverlay,
  manualId: string,
): ShoppingOverlay {
  return {
    ...overlay,
    manual: overlay.manual.filter((m) => m.id !== manualId),
  };
}
