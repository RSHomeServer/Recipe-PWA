import { RoutePlaceholder } from "@/features/shared/RoutePlaceholder";
import { RouteStatePanel } from "@/features/shared/RouteStatePanel";

export default function IngredientsPage() {
  return (
    <RoutePlaceholder
      title="Ingredients"
      description="Your ingredient library — everything else builds on these."
    >
      <RouteStatePanel
        state="empty"
        config={{
          empty: {
            title: "Add your first ingredient — everything else builds on these.",
            actionLabel: "Add ingredient",
          },
          loading: { rows: 5 },
          error: {
            title: "Could not load ingredients",
            description: "Local storage may be unavailable in this browser.",
          },
        }}
      />
    </RoutePlaceholder>
  );
}
