import { DateRangeControl } from "@/features/components/domain-stubs";
import { RoutePlaceholder } from "@/features/shared/RoutePlaceholder";
import { RouteStatePanel } from "@/features/shared/RouteStatePanel";

export default function ShoppingPage() {
  return (
    <RoutePlaceholder
      title="Shopping"
      description="Derived list from your plan and pantry."
    >
      <DateRangeControl label="Shopping for Tue 25 Aug – Mon 31 Aug" />
      <div className="mt-6">
        <RouteStatePanel
          state="empty"
          config={{
            empty: {
              title:
                "Nothing to buy — your plan is covered by what's in the pantry.",
            },
            loading: { rows: 5 },
            error: {
              title: "Could not build shopping list",
              description: "Requirements are computed from local plan and pantry data.",
            },
          }}
        />
      </div>
    </RoutePlaceholder>
  );
}
