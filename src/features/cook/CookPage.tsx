import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { useRecipeData } from "@/data";
import { portionNutrition } from "@/domain";
import { NutritionSummary } from "@/features/components/domain-stubs";
import { useBatchListRows } from "@/features/cook/hooks";
import { PageHeader } from "@/features/shared/RoutePlaceholder";
import { RouteStatePanel } from "@/features/shared/RouteStatePanel";
import { Button } from "@/ui/button";
import { cn } from "@/ui/lib/utils";

const listStateConfig = {
  empty: {
    title: "No batches. Cook a recipe to track portions.",
    actionLabel: "Cook a recipe",
  },
  loading: { rows: 4 },
  error: {
    title: "Could not load batches",
    description: "Batch history is stored locally on this device.",
  },
} as const;

function formatCookedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function CookPage() {
  const navigate = useNavigate();
  const { ready, error: dataError } = useRecipeData();
  const rows = useBatchListRows();
  const [showClosed, setShowClosed] = useState(false);

  const visible = useMemo(() => {
    if (!rows) return undefined;
    return rows.filter((row) => showClosed || row.available || row.batch.closedAt == null);
  }, [rows, showClosed]);

  const goCook = () => {
    void navigate("/cook/new");
  };

  if (dataError) {
    return (
      <div className="app-page">
        <PageHeader title="Batches" description="Cook recipes and track portions remaining." />
        <RouteStatePanel state="error" config={listStateConfig} />
      </div>
    );
  }

  if (!ready || rows === undefined) {
    return (
      <div className="app-page">
        <PageHeader title="Batches" description="Cook recipes and track portions remaining." />
        <RouteStatePanel state="loading" config={listStateConfig} />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="app-page">
        <PageHeader
          title="Batches"
          description="Cook recipes and track portions remaining."
          actions={
            <Button type="button" onClick={goCook}>
              <Plus className="size-4" aria-hidden="true" />
              Cook a recipe
            </Button>
          }
        />
        <RouteStatePanel
          state="empty"
          config={listStateConfig}
          onAction={goCook}
        />
      </div>
    );
  }

  const list = visible ?? rows;

  return (
    <div className="app-page">
      <PageHeader
        title="Batches"
        description="Cook recipes and track portions remaining."
        actions={
          <Button type="button" onClick={goCook}>
            <Plus className="size-4" aria-hidden="true" />
            Cook a recipe
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={showClosed}
            onChange={(event) => setShowClosed(event.target.checked)}
          />
          Show closed batches
        </label>
      </div>

      <ul className="space-y-3">
        {list.map(({ batch, remaining, available }) => {
          const portion = portionNutrition(batch);
          return (
            <li key={batch.id}>
              <Link
                to={`/cook/${batch.id}`}
                className={cn(
                  "block rounded-lg border border-border bg-[var(--color-surface-raised)] p-4 transition-colors hover:bg-muted/40",
                  !available && "opacity-70",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="font-display text-lg font-semibold">
                      {batch.label?.trim() || batch.snapshot.recipeName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {batch.snapshot.recipeName} · {formatCookedAt(batch.cookedAt)}
                    </p>
                    <p className="text-sm">
                      {available
                        ? `${remaining} of ${batch.portionsNominal} portions left`
                        : batch.closedAt
                          ? "Closed"
                          : "No portions left"}
                    </p>
                  </div>
                  <NutritionSummary
                    kcal={Math.round(portion.kcal)}
                    protein={portion.proteinG}
                    carbs={portion.carbsG}
                    fat={portion.fatG}
                    className="text-sm"
                  />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
