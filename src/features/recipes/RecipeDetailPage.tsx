import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useRepos, useRecipeData } from "@/data";
import {
  createId,
  type BuiltRecipeFields,
  type Recipe,
  type RecipeImage,
} from "@/domain";
import { RecipeForm } from "@/features/recipes/RecipeForm";
import {
  useActiveIngredients,
  useIngredientsById,
  useRecipe,
  useRecipeImageUrl,
} from "@/features/recipes/hooks";
import { PageHeader } from "@/features/shared/RoutePlaceholder";
import { RouteStatePanel } from "@/features/shared/RouteStatePanel";

const detailStateConfig = {
  empty: {
    title: "Recipe not found",
    description: "It may have been removed from this device.",
    actionLabel: "Back to recipes",
  },
  loading: { rows: 6 },
  error: {
    title: "Could not load recipe",
    description: "Local storage may be unavailable in this browser.",
  },
} as const;

export default function RecipeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isCreate = id === "new";
  const { ready, error: dataError } = useRecipeData();
  const repos = useRepos();
  const recipe = useRecipe(isCreate ? undefined : id);
  const activeIngredients = useActiveIngredients();
  const ingredientsById = useIngredientsById();
  const { url: existingImageUrl } = useRecipeImageUrl(
    isCreate ? null : (recipe?.imageId ?? null),
  );

  const goList = () => {
    void navigate("/recipes");
  };

  if (dataError) {
    return (
      <div className="app-page prose">
        <PageHeader title="Recipe" />
        <RouteStatePanel state="error" config={detailStateConfig} />
      </div>
    );
  }

  const waitingForRow = !isCreate && recipe === undefined;
  if (
    !ready ||
    activeIngredients === undefined ||
    ingredientsById === undefined ||
    waitingForRow
  ) {
    return (
      <div className="app-page prose">
        <PageHeader title={isCreate ? "New recipe" : "Recipe"} />
        <RouteStatePanel state="loading" config={detailStateConfig} />
      </div>
    );
  }

  if (!isCreate && recipe === null) {
    return (
      <div className="app-page prose">
        <PageHeader title="Recipe" />
        <RouteStatePanel
          state="empty"
          config={detailStateConfig}
          onAction={goList}
        />
      </div>
    );
  }

  const title = isCreate ? "New recipe" : (recipe?.name ?? "Recipe");

  const save = async ({
    fields,
    image,
    removeImage,
  }: {
    fields: BuiltRecipeFields;
    image: RecipeImage | null;
    removeImage: boolean;
  }) => {
    if (!repos) throw new Error("Database is not ready");
    const now = new Date().toISOString();

    if (isCreate) {
      let imageId: string | null = null;
      if (image) {
        await repos.recipeImages.put(image);
        imageId = image.id;
      }
      const row: Recipe = {
        id: createId(),
        ...fields,
        imageId,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      };
      await repos.recipes.put(row);
      toast.success("Recipe created");
      void navigate(`/recipes/${row.id}`, { replace: true });
      return;
    }

    if (!recipe) throw new Error("Recipe not found");

    let imageId = recipe.imageId;
    if (removeImage && recipe.imageId) {
      await repos.recipeImages.delete(recipe.imageId);
      imageId = null;
    }
    if (image) {
      if (recipe.imageId && recipe.imageId !== image.id) {
        await repos.recipeImages.delete(recipe.imageId);
      }
      await repos.recipeImages.put(image);
      imageId = image.id;
    }

    const row: Recipe = {
      ...recipe,
      ...fields,
      imageId,
      updatedAt: now,
    };
    await repos.recipes.put(row);
    toast.success("Recipe saved");
  };

  const archive = async () => {
    if (!repos || !recipe) return;
    await repos.recipes.archive(recipe.id, new Date().toISOString());
    toast.success("Recipe archived");
    goList();
  };

  const restore = async () => {
    if (!repos || !recipe) return;
    await repos.recipes.put({
      ...recipe,
      archivedAt: null,
      updatedAt: new Date().toISOString(),
    });
    toast.success("Recipe restored");
  };

  return (
    <div className="app-page prose">
      <PageHeader
        title={title}
        description={
          isCreate
            ? "Build a recipe from your ingredient library. Nutrition is calculated live."
            : recipe?.archivedAt
              ? "This recipe is archived. Restore it to use it in plans and cooking."
              : "Edit ingredients and servings — totals and breakdown stay derived."
        }
      />
      <RecipeForm
        activeIngredients={activeIngredients}
        ingredientsById={ingredientsById}
        initial={isCreate ? undefined : (recipe ?? undefined)}
        existingImageUrl={existingImageUrl}
        onSubmit={save}
        onArchive={isCreate ? undefined : archive}
        onRestore={isCreate ? undefined : restore}
        onCancel={goList}
      />
    </div>
  );
}
