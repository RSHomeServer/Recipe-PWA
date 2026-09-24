import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useRepos, useRecipeData } from "@/data";
import {
  createId,
  type Ingredient,
  type IngredientFormParsed,
  type RecipeImage,
} from "@/domain";
import { IngredientForm } from "@/features/ingredients/IngredientForm";
import {
  useIngredient,
  useIngredientCategories,
  useIngredientMeasureKindLocked,
} from "@/features/ingredients/hooks";
import { useRecipeImageUrl } from "@/features/recipes/hooks";
import { PageHeader } from "@/features/shared/RoutePlaceholder";
import { RouteStatePanel } from "@/features/shared/RouteStatePanel";

const detailStateConfig = {
  empty: {
    title: "Ingredient not found",
    description: "It may have been removed from this device.",
    actionLabel: "Back to ingredients",
  },
  loading: { rows: 6 },
  error: {
    title: "Could not load ingredient",
    description: "Local storage may be unavailable in this browser.",
  },
} as const;

export default function IngredientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isCreate = id === "new";
  const { ready, error: dataError } = useRecipeData();
  const repos = useRepos();
  const categories = useIngredientCategories();
  const ingredient = useIngredient(isCreate ? undefined : id);
  const measureKindLocked =
    useIngredientMeasureKindLocked(isCreate ? undefined : id) ?? false;
  const { url: existingImageUrl } = useRecipeImageUrl(
    isCreate ? null : (ingredient?.imageId ?? null),
  );

  const goList = () => {
    void navigate("/ingredients");
  };

  if (dataError) {
    return (
      <div className="app-page prose">
        <PageHeader title="Ingredient" />
        <RouteStatePanel state="error" config={detailStateConfig} />
      </div>
    );
  }

  const waitingForRow = !isCreate && ingredient === undefined;
  if (!ready || categories === undefined || waitingForRow) {
    return (
      <div className="app-page prose">
        <PageHeader title={isCreate ? "New ingredient" : "Ingredient"} />
        <RouteStatePanel state="loading" config={detailStateConfig} />
      </div>
    );
  }

  if (!isCreate && ingredient === null) {
    return (
      <div className="app-page prose">
        <PageHeader title="Ingredient" />
        <RouteStatePanel
          state="empty"
          config={detailStateConfig}
          onAction={goList}
        />
      </div>
    );
  }

  const title = isCreate
    ? "New ingredient"
    : (ingredient?.name ?? "Ingredient");

  const save = async (payload: {
    values: IngredientFormParsed;
    image: RecipeImage | null;
    removeImage: boolean;
  }) => {
    if (!repos) throw new Error("Database is not ready");
    const { values: parsed, image, removeImage } = payload;

    if (isCreate) {
      let imageId: string | null = null;
      if (image) {
        await repos.recipeImages.put(image);
        imageId = image.id;
      }
      const row: Ingredient = {
        id: createId(),
        ...parsed,
        source: {
          kind: "userEntered",
          datasetId: null,
          datasetName: null,
          entryCode: null,
          entryName: null,
          licence: null,
          url: null,
          retrievedAt: null,
          note: null,
        },
        imageId,
        common: true,
        archivedAt: null,
      };
      await repos.ingredients.put(row);
      toast.success("Ingredient created");
      void navigate(`/ingredients/${row.id}`, { replace: true });
      return;
    }

    if (!ingredient) throw new Error("Ingredient not found");

    if (measureKindLocked && parsed.measureKind !== ingredient.measureKind) {
      throw new Error(
        "Measure kind cannot change while this ingredient is in use",
      );
    }

    let imageId = ingredient.imageId;
    if (removeImage && ingredient.imageId) {
      await repos.recipeImages.delete(ingredient.imageId);
      imageId = null;
    }
    if (image) {
      if (ingredient.imageId && ingredient.imageId !== image.id) {
        await repos.recipeImages.delete(ingredient.imageId);
      }
      await repos.recipeImages.put(image);
      imageId = image.id;
    }

    const row: Ingredient = {
      ...ingredient,
      ...parsed,
      measureKind: measureKindLocked
        ? ingredient.measureKind
        : parsed.measureKind,
      imageId,
    };
    await repos.ingredients.put(row);
    toast.success("Ingredient saved");
  };

  const archive = async () => {
    if (!repos || !ingredient) return;
    await repos.ingredients.archive(ingredient.id, new Date().toISOString());
    toast.success("Ingredient archived");
    goList();
  };

  const restore = async () => {
    if (!repos || !ingredient) return;
    await repos.ingredients.put({ ...ingredient, archivedAt: null });
    toast.success("Ingredient restored");
  };

  return (
    <div className="app-page prose">
      <PageHeader
        title={title}
        description={
          isCreate
            ? "Add nutrition on the fixed basis for the measure kind you choose."
            : ingredient?.archivedAt
              ? "This ingredient is archived. Restore it to use it in recipes again."
              : "Edit details. Nutrition changes apply to future recipe and log calculations."
        }
      />
      <IngredientForm
        categories={categories}
        initial={isCreate ? undefined : (ingredient ?? undefined)}
        existingImageUrl={existingImageUrl}
        measureKindLocked={!isCreate && measureKindLocked}
        onSubmit={save}
        onArchive={isCreate ? undefined : archive}
        onRestore={isCreate ? undefined : restore}
        onCancel={goList}
      />
    </div>
  );
}
