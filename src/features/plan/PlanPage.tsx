import { MealSlotSection, PlanSlotTile } from "@/features/components/domain-stubs";
import { RoutePlaceholder } from "@/features/shared/RoutePlaceholder";
import { RouteStatePanel } from "@/features/shared/RouteStatePanel";

export default function PlanPage() {
  return (
    <RoutePlaceholder
      title="Meal plan"
      description="Plan meals by day and slot."
    >
      <RouteStatePanel
        state="empty"
        config={{
          empty: {
            title: "Nothing planned for this week.",
            actionLabel: "Plan a meal",
          },
          loading: { rows: 4 },
          error: {
            title: "Could not load meal plan",
            description: "Your plan is stored locally.",
          },
        }}
      />
      <div className="mt-8 space-y-6 opacity-60" aria-hidden="true">
        <MealSlotSection slotLabel="Lunch">
          <PlanSlotTile variant="cook" title="Example cook slot" subtitle="Stub preview" />
        </MealSlotSection>
      </div>
    </RoutePlaceholder>
  );
}
