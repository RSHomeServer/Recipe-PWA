import { RoutePlaceholder } from "@/features/shared/RoutePlaceholder";
import { RouteStatePanel } from "@/features/shared/RouteStatePanel";

export default function CookPage() {
  return (
    <RoutePlaceholder
      title="Batches"
      description="Cook recipes and track portions remaining."
    >
      <RouteStatePanel
        state="empty"
        config={{
          empty: {
            title: "No batches. Cook a recipe to track portions.",
            actionLabel: "Cook a recipe",
          },
          loading: { rows: 3 },
          error: {
            title: "Could not load batches",
            description: "Batch history is stored locally on this device.",
          },
        }}
      />
    </RoutePlaceholder>
  );
}
