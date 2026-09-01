import { RoutePlaceholder } from "@/features/shared/RoutePlaceholder";
import { RouteStatePanel } from "@/features/shared/RouteStatePanel";

export default function RecipesPage() {
  return (
    <RoutePlaceholder
      title="Recipes"
      description="Recipes built from your ingredients, with availability and nutrition."
    >
      <RouteStatePanel
        state="empty"
        config={{
          empty: {
            title: "No recipes yet. Recipes are built from your ingredients.",
            actionLabel: "Create recipe",
          },
          loading: { rows: 4 },
          error: {
            title: "Could not load recipes",
            description: "Try again — your recipes are stored locally.",
          },
        }}
      />
    </RoutePlaceholder>
  );
}
