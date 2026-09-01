import { RoutePlaceholder } from "@/features/shared/RoutePlaceholder";
import { RouteStatePanel } from "@/features/shared/RouteStatePanel";

export default function PantryPage() {
  return (
    <RoutePlaceholder
      title="Pantry"
      description="What you have in stock and what you can cook."
    >
      <RouteStatePanel
        state="empty"
        config={{
          empty: {
            title: "Your pantry is empty. Add what you have to see what you can cook.",
            actionLabel: "Add stock",
          },
          loading: { rows: 6 },
          error: {
            title: "Could not load pantry",
            description: "Pantry data is stored on this device.",
          },
        }}
      />
    </RoutePlaceholder>
  );
}
