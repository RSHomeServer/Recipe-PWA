import { useParams } from "react-router-dom";
import { RoutePlaceholder } from "@/features/shared/RoutePlaceholder";

export default function RecipeDetailPage() {
  const { id } = useParams();

  return (
    <RoutePlaceholder
      title="Recipe"
      description={`Recipe detail stub for ${id ?? "unknown"}.`}
    />
  );
}
