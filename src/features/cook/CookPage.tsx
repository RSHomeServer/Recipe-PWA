import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { useRecipeData } from "@/data";
import { portionNutrition } from "@/domain";
import { NutritionSummary } from "@/features/components/domain-stubs";
import { useBatchListRows } from "@/features/cook/hooks";
import { HowThisWorksPanel } from "@/features/shared/HowThisWorks";
import { InfoPopover } from "@/features/shared/InfoPopover";
import { LEXICON } from "@/features/shared/entry-kind-copy";
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

const COOK_DESCRIPTION =
  "A batch is one cooking session. You cooked a recipe, it made portions, and those portions are now food in your fridge or freezer.";

function formatCookedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function CookPageHeader({
  actions,
}: {
  actions?: ReactNode;
}) {
  return (
    <PageHeader
      title="Batches"
      titleAccessory={
        <InfoPopover label="What is a batch?">
          <p className="font-medium text-foreground">Batch</p>
          <p className="mt-1 text-muted-foreground">{LEXICON.batch}</p>
          <p className="mt-3 font-medium text-foreground">Portion</p>
          <p className="mt-1 text-muted-foreground">{LEXICON.portion}</p>
          <p className="mt-3 text-muted-foreground">
            Planning to eat a portion adds nothing to your shopping list,
            because you already bought and cooked it.
          </p>
        </InfoPopover>
      }
      description={COOK_DESCRIPTION}
      actions={actions}
    />
  );
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
      <div className="app-page content space-y-8">
        <CookPageHeader />
        <RouteStatePanel state="error" config={listStateConfig} />
      </div>
    );
  }

  if (!ready || rows === undefined) {
    return (
      <div className="app-page content space-y-8">
        <CookPageHeader />
        <RouteStatePanel state="loading" config={listStateConfig} />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="app-page content space-y-8">
        <CookPageHeader
          actions={
            <Button type="button" onClick={goCook}>
              <Plus className="size-4" aria-hidden="true" />
              Cook a recipe
            </Button>
          }
        />
        <HowThisWorksPanel />
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
    <div className="app-page content space-y-8">
      <CookPageHeader
        actions={
          <Button type="button" onClick={goCook}>
            <Plus className="size-4" aria-hidden="true" />
            Cook a recipe
          </Button>
        }
      />

      <HowThisWorksPanel />

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
                <div className="app-list-row items-start gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
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
                  <div className="app-list-row-metrics">
                    <NutritionSummary
                      kcal={Math.round(portion.kcal)}
                      protein={portion.proteinG}
                      carbs={portion.carbsG}
                      fat={portion.fatG}
                      className="text-sm"
                    />
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
