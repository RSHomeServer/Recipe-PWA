import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useRepos, useRecipeData } from "@/data";
import {
  batchNutrition,
  closeBatch,
  formatNutrition,
  isBatchAvailable,
  portionNutrition,
  portionsRemaining,
  portionsRemainingDisplay,
} from "@/domain";
import { NutritionSummary } from "@/features/components/domain-stubs";
import { useBatch, useLoggedMeals } from "@/features/cook/hooks";
import { PageHeader } from "@/features/shared/RoutePlaceholder";
import { RouteStatePanel } from "@/features/shared/RouteStatePanel";
import { Button } from "@/ui/button";

const detailStateConfig = {
  empty: {
    title: "Batch not found",
    description: "It may have been removed from this device.",
    actionLabel: "Back to batches",
  },
  loading: { rows: 5 },
  error: {
    title: "Could not load batch",
    description: "Local storage may be unavailable in this browser.",
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

export default function BatchDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { ready, error: dataError } = useRecipeData();
  const repos = useRepos();
  const batch = useBatch(id);
  const logs = useLoggedMeals();

  const goList = () => {
    void navigate("/cook");
  };

  if (dataError) {
    return (
      <div className="app-page content">
        <PageHeader title="Batch" />
        <RouteStatePanel state="error" config={detailStateConfig} />
      </div>
    );
  }

  if (!ready || batch === undefined || logs === undefined) {
    return (
      <div className="app-page content">
        <PageHeader title="Batch" />
        <RouteStatePanel state="loading" config={detailStateConfig} />
      </div>
    );
  }

  if (batch === null) {
    return (
      <div className="app-page content">
        <PageHeader title="Batch" />
        <RouteStatePanel
          state="empty"
          config={detailStateConfig}
          onAction={goList}
        />
      </div>
    );
  }

  const remaining = portionsRemainingDisplay(batch, logs);
  const rawRemaining = portionsRemaining(batch, logs);
  const available = isBatchAvailable(batch, logs);
  const total = batchNutrition(batch);
  const portion = portionNutrition(batch);
  const totalFmt = formatNutrition(total);
  const portionFmt = formatNutrition(portion);

  const onClose = async () => {
    if (!repos) return;
    if (batch.closedAt) {
      toast.message("Batch is already closed");
      return;
    }
    try {
      const next = closeBatch(batch, new Date().toISOString());
      await repos.batches.update(batch.id, { closedAt: next.closedAt });
      toast.success("Batch closed — remaining portions written off");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not close batch",
      );
    }
  };

  return (
    <div className="app-page content space-y-8">
      <PageHeader
        title={batch.label?.trim() || batch.snapshot.recipeName}
        description={`${batch.snapshot.recipeName} · cooked ${formatCookedAt(batch.cookedAt)}`}
        actions={
          <Button type="button" variant="outline" onClick={goList}>
            All batches
          </Button>
        }
      />

      <section className="space-y-3">
        <p className="text-base">
          {available
            ? `${remaining} of ${batch.portionsNominal} portions remaining`
            : batch.closedAt
              ? `Closed ${formatCookedAt(batch.closedAt)}`
              : "No portions remaining"}
        </p>
        {rawRemaining < 0 ? (
          <p className="text-sm text-muted-foreground">
            Logged portions exceed nominal by {Math.abs(rawRemaining)} — records
            and reality disagree.
          </p>
        ) : null}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Per portion
          </p>
          <NutritionSummary
            kcal={Math.round(portion.kcal)}
            protein={portion.proteinG}
            carbs={portion.carbsG}
            fat={portion.fatG}
            variant="row"
          />
          <p className="text-sm font-medium text-muted-foreground">
            Batch total ({totalFmt.kcal} kcal)
          </p>
          <NutritionSummary
            kcal={Math.round(total.kcal)}
            protein={total.proteinG}
            carbs={total.carbsG}
            fat={total.fatG}
            variant="row"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Snapshot ingredients</h2>
        <ul className="space-y-2">
          {batch.snapshot.lines.map((line) => {
            const lineFmt = formatNutrition(line.nutrition);
            return (
              <li
                key={`${line.ingredientId}-${line.ingredientName}`}
                className="flex flex-wrap items-baseline justify-between gap-2 border-t border-border pt-2"
              >
                <span>
                  {line.ingredientName}{" "}
                  <span className="num text-muted-foreground">
                    {line.quantity.amount}
                    {line.quantity.kind === "mass"
                      ? " g"
                      : line.quantity.kind === "volume"
                        ? " ml"
                        : ""}
                  </span>
                </span>
                <span className="num text-sm text-muted-foreground">
                  {lineFmt.kcal} kcal
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {batch.notes ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Notes</h2>
          <p className="text-base text-muted-foreground whitespace-pre-wrap">
            {batch.notes}
          </p>
        </section>
      ) : null}

      {batch.closedAt == null ? (
        <Button type="button" variant="outline" onClick={() => void onClose()}>
          Close batch
        </Button>
      ) : null}

      <p className="text-sm text-muted-foreground">
        Scale {batch.scale}× · {portionFmt.kcal} kcal per portion. Logging
        portions arrives in a later step — remaining equals nominal until then.
      </p>
    </div>
  );
}
