import { RoutePlaceholder } from "@/features/shared/RoutePlaceholder";
import { RouteStatePanel } from "@/features/shared/RouteStatePanel";

export default function LogPage() {
  return (
    <RoutePlaceholder
      title="Log"
      description="Diary by day — fast meal logging."
    >
      <RouteStatePanel
        state="empty"
        config={{
          empty: {
            title: "Nothing logged today.",
            actionLabel: "Log a meal",
          },
          loading: { rows: 4 },
          error: {
            title: "Could not load log",
            description: "Meal logs are stored on this device.",
          },
        }}
      />
    </RoutePlaceholder>
  );
}
