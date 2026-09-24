import { useState } from "react";
import { Check, MoreHorizontal } from "lucide-react";
import {
  formatQuantity,
  type CanonicalQuantity,
} from "@/domain";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { cn } from "@/ui/lib/utils";
import type { ShoppingLineView } from "./hooks";

export type ShoppingLineRowProps = {
  line: ShoppingLineView;
  onTick: (line: ShoppingLineView) => void;
  onSuppress: (line: ShoppingLineView) => void;
  onAdjust: (line: ShoppingLineView, quantity: CanonicalQuantity | null) => void;
};

export function ShoppingLineRow({
  line,
  onTick,
  onSuppress,
  onAdjust,
}: ShoppingLineRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [adjustValue, setAdjustValue] = useState(
    String(line.buyQuantity.amount),
  );

  const calculatedLabel = formatQuantity(line.toBuy);
  const buyLabel = formatQuantity(line.buyQuantity);

  return (
    <li
      data-slot="shopping-line"
      className={cn(
        "flex items-start gap-3 border-b border-[var(--color-border-subtle)] py-3 last:border-b-0",
        line.checked && "opacity-60",
      )}
    >
      <button
        type="button"
        className={cn(
          "mt-0.5 inline-flex size-12 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
          line.checked
            ? "border-[var(--color-success)] bg-[var(--color-success)] text-primary-foreground"
            : "border-border bg-background",
        )}
        aria-label={
          line.checked
            ? `Bought ${line.ingredient.name}`
            : `Mark ${line.ingredient.name} bought`
        }
        aria-pressed={line.checked}
        disabled={line.checked}
        onClick={() => onTick(line)}
      >
        {line.checked ? <Check className="size-6" aria-hidden /> : null}
      </button>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="app-list-row flex-wrap items-baseline gap-2">
          <p className="min-w-0 flex-1 font-medium leading-snug">
            {line.ingredient.name}
          </p>
          <p className="app-list-row-metrics num text-base font-semibold">
            {buyLabel}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Need {formatQuantity(line.required)}
          {" · "}
          Have {formatQuantity(line.inPantry)}
          {line.hasAdjustment ? (
            <>
              {" · "}
              <span>
                Calculated {calculatedLabel}, buying {buyLabel}
              </span>
            </>
          ) : null}
          {line.isManual ? (
            <>
              {" · "}
              <span>Manual</span>
            </>
          ) : null}
        </p>

        {adjusting ? (
          <form
            className="flex flex-wrap items-end gap-2 pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              const amount = Number(adjustValue);
              if (!Number.isFinite(amount) || amount < 0) return;
              onAdjust(line, { amount, kind: line.toBuy.kind });
              setAdjusting(false);
              setMenuOpen(false);
            }}
          >
            <div className="space-y-1">
              <Label htmlFor={`adjust-${line.ingredientId}`}>
                Buy amount (canonical{" "}
                {line.toBuy.kind === "mass"
                  ? "g"
                  : line.toBuy.kind === "volume"
                    ? "ml"
                    : "items"}
                )
              </Label>
              <Input
                id={`adjust-${line.ingredientId}`}
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={adjustValue}
                onChange={(e) => setAdjustValue(e.target.value)}
                className="w-36"
              />
            </div>
            <Button type="submit" size="sm">
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                onAdjust(line, null);
                setAdjusting(false);
              }}
            >
              Clear
            </Button>
          </form>
        ) : null}

        {menuOpen && !adjusting ? (
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setAdjustValue(String(line.buyQuantity.amount));
                setAdjusting(true);
              }}
            >
              Adjust buy qty
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                onSuppress(line);
                setMenuOpen(false);
              }}
            >
              Don&apos;t need this
            </Button>
          </div>
        ) : null}
      </div>

      {!line.checked ? (
        <button
          type="button"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          aria-label={`More actions for ${line.ingredient.name}`}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <MoreHorizontal className="size-5" />
        </button>
      ) : null}
    </li>
  );
}
