import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { AvailabilityIndicator } from "@/features/components/domain-stubs";
import { PageHeader } from "@/features/shared/RoutePlaceholder";
import { RouteStatePanel } from "@/features/shared/RouteStatePanel";
import { useRecipeData } from "@/data";
import { useActiveIngredients } from "@/features/recipes/hooks";
import { AddStockForm } from "@/features/pantry/AddStockForm";
import {
  usePantryStockByIngredientId,
  usePantryStockRows,
  useRecipeAvailabilityRows,
  type PantryStockRow,
} from "@/features/pantry/hooks";
import { StockRow } from "@/features/pantry/StockRow";
import { Button } from "@/ui/button";

const listStateConfig = {
  empty: {
    title: "Your pantry is empty. Add what you have to see what you can cook.",
    actionLabel: "Add stock",
  },
  loading: { rows: 6 },
  error: {
    title: "Could not load pantry",
    description: "Pantry data is stored on this device.",
  },
} as const;

const noIngredientsConfig = {
  empty: {
    title: "Your pantry is empty. Add what you have to see what you can cook.",
    description:
      "Add a few ingredients first, then record what you have in stock.",
    actionLabel: "Add ingredients first",
  },
  loading: { rows: 6 },
  error: listStateConfig.error,
} as const;

type StockGroup = {
  key: string;
  label: string;
  sortOrder: number;
  rows: PantryStockRow[];
};

function groupRows(rows: PantryStockRow[]): StockGroup[] {
  const map = new Map<string, StockGroup>();
  for (const row of rows) {
    const category = row.category;
    const key = category?.id ?? "uncategorized";
    const label = category?.name ?? "Uncategorized";
    const sortOrder = category?.sortOrder ?? Number.POSITIVE_INFINITY;
    const existing = map.get(key);
    if (existing) {
      existing.rows.push(row);
    } else {
      map.set(key, { key, label, sortOrder, rows: [row] });
    }
  }
  return [...map.values()].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
  });
}

export default function PantryPage() {
  const navigate = useNavigate();
  const { ready, error: dataError } = useRecipeData();
  const stockRows = usePantryStockRows();
  const stockById = usePantryStockByIngredientId();
  const availabilityRows = useRecipeAvailabilityRows();
  const activeIngredients = useActiveIngredients();
  const [showAdd, setShowAdd] = useState(false);

  const groups = useMemo(
    () => (stockRows ? groupRows(stockRows) : undefined),
    [stockRows],
  );

  const addCandidates = useMemo(() => {
    if (!activeIngredients || !stockById) return undefined;
    const missing = activeIngredients.filter(
      (ingredient) => !stockById.has(ingredient.id),
    );
    // Prefer ingredients without a row; fall back to all so Adjust isn't the
    // only path when every ingredient already has stock.
    return missing.length > 0 ? missing : activeIngredients;
  }, [activeIngredients, stockById]);

  if (dataError) {
    return (
      <div className="app-page">
        <PageHeader
          title="Pantry"
          description="What you have in stock and what you can cook."
        />
        <RouteStatePanel state="error" config={listStateConfig} />
      </div>
    );
  }

  if (
    !ready ||
    stockRows === undefined ||
    stockById === undefined ||
    availabilityRows === undefined ||
    activeIngredients === undefined ||
    addCandidates === undefined
  ) {
    return (
      <div className="app-page">
        <PageHeader
          title="Pantry"
          description="What you have in stock and what you can cook."
        />
        <RouteStatePanel state="loading" config={listStateConfig} />
      </div>
    );
  }

  const noIngredients = activeIngredients.length === 0;
  const isEmpty = stockRows.length === 0;
  const showAddForm = showAdd || (isEmpty && !noIngredients);

  return (
    <div className="app-page space-y-10">
      <PageHeader
        title="Pantry"
        description="What you have in stock and what you can cook."
        actions={
          noIngredients || showAddForm ? null : (
            <Button type="button" onClick={() => setShowAdd(true)}>
              <Plus className="size-4" aria-hidden="true" />
              Add stock
            </Button>
          )
        }
      />

      {noIngredients ? (
        <RouteStatePanel
          state="empty"
          config={noIngredientsConfig}
          onAction={() => void navigate("/ingredients")}
        />
      ) : (
        <>
          {showAddForm ? (
            <section className="space-y-3" aria-labelledby="add-stock-heading">
              <h2
                id="add-stock-heading"
                className="font-display text-lg font-semibold"
              >
                Add stock
              </h2>
              <p className="text-sm text-muted-foreground">
                One quantity per ingredient. Stock currently changes only from
                this screen — cooking deduction arrives with batches.
              </p>
              <AddStockForm
                candidates={addCandidates}
                stockById={stockById}
                onDone={() => setShowAdd(false)}
              />
              {!isEmpty ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdd(false)}
                >
                  Cancel
                </Button>
              ) : null}
            </section>
          ) : null}

          {!isEmpty ? (
            <section className="space-y-6" aria-labelledby="stock-heading">
              <h2
                id="stock-heading"
                className="font-display text-lg font-semibold"
              >
                In stock
              </h2>
              {groups?.map((group) => (
                <div key={group.key} className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    {group.label}
                  </h3>
                  <ul className="divide-y divide-border border-y border-border">
                    {group.rows.map((row) => (
                      <StockRow
                        key={row.ingredient.id}
                        ingredient={row.ingredient}
                        stock={row.stock}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ) : null}

          <section className="space-y-4" aria-labelledby="can-make-heading">
            <div className="space-y-1">
              <h2
                id="can-make-heading"
                className="font-display text-lg font-semibold"
              >
                What can I make?
              </h2>
              <p className="text-sm text-muted-foreground">
                Three states from recipe requirements versus pantry — always
                with named shortfalls. Availability never blocks cooking.
              </p>
            </div>

            {availabilityRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No recipes yet.{" "}
                <Link className="underline underline-offset-2" to="/recipes">
                  Create a recipe
                </Link>{" "}
                to see what you can cook from stock.
              </p>
            ) : (
              <ul className="divide-y divide-border border-y border-border">
                {availabilityRows.map((row) => (
                  <li
                    key={row.recipe.id}
                    className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <Link
                        to={`/recipes/${row.recipe.id}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {row.recipe.name}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {row.recipe.servings}{" "}
                        {row.recipe.servings === 1 ? "serving" : "servings"}
                      </p>
                    </div>
                    <AvailabilityIndicator
                      state={row.availability.status}
                      shortfalls={row.shortfallLabels}
                      className="sm:max-w-sm"
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
