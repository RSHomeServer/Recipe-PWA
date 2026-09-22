import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  applyStockMutation,
  formatQuantity,
  isNegativeStock,
  preferredDisplayUnit,
  unitsForKind,
  type Ingredient,
  type PantryStock,
  type Quantity,
  type Unit,
} from "@/domain";
import { useRepos } from "@/data";
import { Quantity as QuantityDisplay } from "@/features/components/domain-stubs";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { NativeSelect } from "@/ui/native-select";
import { cn } from "@/ui/lib/utils";

function parseAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

type AdjustMode = "add" | "remove" | "set";

export type StockRowProps = {
  ingredient: Ingredient;
  stock: PantryStock;
};

export function StockRow({ ingredient, stock }: StockRowProps) {
  const repos = useRepos();
  const units = unitsForKind(ingredient.measureKind);
  const defaultUnit = preferredDisplayUnit(stock.quantity);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AdjustMode>("add");
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState<Unit>(defaultUnit);
  const [busy, setBusy] = useState(false);

  const negative = isNegativeStock(stock.quantity);
  const display = formatQuantity(stock.quantity);
  const [amountPart, ...unitParts] = display.split(" ");
  const unitPart = unitParts.join(" ");

  const quickStep = useMemo((): Quantity => {
    switch (ingredient.measureKind) {
      case "mass":
        return { value: 100, unit: "g" };
      case "volume":
        return { value: 100, unit: "ml" };
      case "count":
        return { value: 1, unit: "item" };
    }
  }, [ingredient.measureKind]);

  const apply = async (mutation: {
    op: AdjustMode;
    quantity: Quantity;
  }) => {
    if (!repos) return;
    setBusy(true);
    try {
      const result = applyStockMutation(
        stock,
        ingredient,
        mutation,
        new Date().toISOString(),
      );
      if (!result.ok) {
        toast.error(
          `Use a ${result.expected} unit (${result.allowed.join(", ")})`,
        );
        return;
      }
      await repos.pantryStock.put(result.stock);
      setAmount("");
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update stock",
      );
    } finally {
      setBusy(false);
    }
  };

  const onSubmitAdjust = async (event: FormEvent) => {
    event.preventDefault();
    const value = parseAmount(amount);
    if (value == null) {
      toast.error("Enter a non-negative amount");
      return;
    }
    await apply({ op: mode, quantity: { value, unit } });
  };

  const onSetToZero = async () => {
    await apply({
      op: "set",
      quantity: { value: 0, unit: units[0]! },
    });
  };

  return (
    <li
      className={cn(
        "border-b border-border py-4 last:border-b-0",
        negative && "bg-[color-mix(in_oklab,var(--color-muted)_35%,transparent)]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="font-medium">{ingredient.name}</p>
          <QuantityDisplay
            amount={amountPart ?? display}
            unit={unitPart || undefined}
            className="text-base"
          />
          {negative ? (
            <p className="text-sm text-muted-foreground">
              Records are behind what you used — correct when you can.
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {negative ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void onSetToZero()}
            >
              Set to 0
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void apply({ op: "remove", quantity: quickStep })}
            aria-label={`Remove ${quickStep.value}${quickStep.unit === "item" ? "" : ` ${quickStep.unit}`}`}
          >
            −
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void apply({ op: "add", quantity: quickStep })}
            aria-label={`Add ${quickStep.value}${quickStep.unit === "item" ? "" : ` ${quickStep.unit}`}`}
          >
            +
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => {
              setUnit(preferredDisplayUnit(stock.quantity));
              setOpen((value) => !value);
            }}
          >
            {open ? "Close" : "Adjust"}
          </Button>
        </div>
      </div>

      {open ? (
        <form
          className="mt-4 grid gap-3 sm:grid-cols-[8rem_7rem_1fr_auto]"
          onSubmit={(event) => void onSubmitAdjust(event)}
        >
          <div className="space-y-2">
            <Label htmlFor={`stock-mode-${ingredient.id}`}>Action</Label>
            <NativeSelect
              id={`stock-mode-${ingredient.id}`}
              value={mode}
              onChange={(event) => setMode(event.target.value as AdjustMode)}
            >
              <option value="add">Add</option>
              <option value="remove">Remove</option>
              <option value="set">Set to</option>
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`stock-amount-${ingredient.id}`}>Amount</Label>
            <Input
              id={`stock-amount-${ingredient.id}`}
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`stock-unit-${ingredient.id}`}>Unit</Label>
            <NativeSelect
              id={`stock-unit-${ingredient.id}`}
              value={unit}
              onChange={(event) => setUnit(event.target.value as Unit)}
            >
              {units.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={busy}>
              Apply
            </Button>
          </div>
        </form>
      ) : null}
    </li>
  );
}
