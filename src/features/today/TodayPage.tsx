import { useState } from "react";
import {
  AvailabilityIndicator,
  MacroBar,
  NutritionSummary,
  PlanSlotTile,
  PortionStepper,
  Quantity,
  TargetReadout,
} from "@/features/components/domain-stubs";
import { RoutePlaceholder } from "@/features/shared/RoutePlaceholder";
import { RouteStatePanel } from "@/features/shared/RouteStatePanel";
import type { ViewState } from "@/features/shared/route-states";
import { Button } from "@/ui/button";

const todayStateConfig = {
  empty: {
    title: "Nothing logged today.",
    description: "Log a meal to see today's summary here.",
    actionLabel: "Log a meal",
  },
  loading: { rows: 3 },
  error: {
    title: "Could not load today's summary",
    description:
      "Your data is still on this device. This is usually a temporary storage read issue.",
    retryLabel: "Try again",
  },
};

export default function TodayPage() {
  const [viewState, setViewState] = useState<ViewState>("empty");
  const [portions, setPortions] = useState(1);

  return (
    <RoutePlaceholder
      title="Today"
      description="What to eat, quick-log, and plan for today."
    >
      <section className="mb-10 space-y-4" aria-labelledby="state-patterns-heading">
        <h2 id="state-patterns-heading" className="text-lg font-semibold">
          View states
        </h2>
        <div className="flex flex-wrap gap-2">
          {(["empty", "loading", "error"] as const).map((state) => (
            <Button
              key={state}
              type="button"
              variant={viewState === state ? "default" : "outline"}
              onClick={() => setViewState(state)}
            >
              {state}
            </Button>
          ))}
        </div>
        <RouteStatePanel
          state={viewState}
          config={todayStateConfig}
          onRetry={() => setViewState("empty")}
          onAction={() => setViewState("empty")}
        />
      </section>

      <section className="space-y-6" aria-labelledby="component-stubs-heading">
        <h2 id="component-stubs-heading" className="text-lg font-semibold">
          Component stubs
        </h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3 rounded-lg border border-border p-4">
            <Quantity amount="1.2" unit="kg" />
            <NutritionSummary kcal={524} protein={42.4} carbs={38.2} fat={18.6} variant="row" />
            <TargetReadout target={2400} consumed={1840} />
            <MacroBar
              segments={[
                { key: "protein", value: 35, label: "Protein" },
                { key: "carbs", value: 40, label: "Carbs" },
                { key: "fat", value: 25, label: "Fat" },
              ]}
            />
          </div>
          <div className="space-y-3">
            <AvailabilityIndicator
              state="almostCanMake"
              shortfalls={["onion 50 g", "garlic 2 cloves"]}
            />
            <PortionStepper value={portions} onChange={setPortions} />
            <div className="grid gap-3 sm:grid-cols-2">
              <PlanSlotTile
                variant="cook"
                title="Chicken tray bake"
                subtitle="Dinner · serves 4"
              />
              <PlanSlotTile
                variant="portion"
                title="Batch: Lentil soup"
                subtitle="2 portions left"
              />
            </div>
          </div>
        </div>
      </section>
    </RoutePlaceholder>
  );
}
