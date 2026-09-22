import { AttributionList, MacroBar } from "@/features/components/domain-stubs";
import { RoutePlaceholder } from "@/features/shared/RoutePlaceholder";
import { RouteStatePanel } from "@/features/shared/RouteStatePanel";

export default function InsightsPage() {
  return (
    <RoutePlaceholder
      title="Insights"
      description="Where your calories came from — organised by question."
    >
      <RouteStatePanel
        state="empty"
        config={{
          empty: {
            title: "Log a few meals and this will show where your calories came from.",
          },
          loading: { rows: 3 },
          error: {
            title: "Could not load insights",
            description: "Insights are computed from your local meal log.",
          },
        }}
      />
      <div className="mt-8 space-y-6 opacity-60" aria-hidden="true">
        <MacroBar
          segments={[
            { key: "protein", value: 30, label: "Protein" },
            { key: "carbs", value: 45, label: "Carbs" },
            { key: "fat", value: 25, label: "Fat" },
          ]}
        />
        <AttributionList
          items={[
            { name: "Chicken breast", percent: 28 },
            { name: "Olive oil", percent: 14 },
            { name: "Unattributed", percent: 8 },
          ]}
        />
      </div>
    </RoutePlaceholder>
  );
}
