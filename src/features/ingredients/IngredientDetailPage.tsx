import { useParams } from "react-router-dom";
import { RoutePlaceholder } from "@/features/shared/RoutePlaceholder";

export default function IngredientDetailPage() {
  const { id } = useParams();

  return (
    <RoutePlaceholder
      title="Ingredient"
      description={`Detail view stub for ingredient ${id ?? "unknown"}.`}
    />
  );
}
