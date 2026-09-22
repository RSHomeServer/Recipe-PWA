import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { ShellLayout } from "@/app/shell/ShellLayout";

const TodayPage = lazy(() => import("@/features/today/TodayPage"));
const IngredientsPage = lazy(() => import("@/features/ingredients/IngredientsPage"));
const IngredientDetailPage = lazy(
  () => import("@/features/ingredients/IngredientDetailPage"),
);
const RecipesPage = lazy(() => import("@/features/recipes/RecipesPage"));
const RecipeDetailPage = lazy(() => import("@/features/recipes/RecipeDetailPage"));
const PantryPage = lazy(() => import("@/features/pantry/PantryPage"));
const CookPage = lazy(() => import("@/features/cook/CookPage"));
const PlanPage = lazy(() => import("@/features/plan/PlanPage"));
const ShoppingPage = lazy(() => import("@/features/shopping/ShoppingPage"));
const LogPage = lazy(() => import("@/features/log/LogPage"));
const InsightsPage = lazy(() => import("@/features/insights/InsightsPage"));
const SettingsPage = lazy(() => import("@/features/settings/SettingsPage"));
const MorePage = lazy(() => import("@/features/more/MorePage"));

function RouteFallback() {
  return (
    <div className="app-page space-y-3" aria-busy="true">
      <div className="h-8 w-48 rounded-md bg-muted" />
      <div className="h-4 w-80 max-w-full rounded-md bg-muted" />
      <div className="h-24 w-full rounded-md bg-muted" />
    </div>
  );
}

export function AppShell() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<ShellLayout />}>
          <Route index element={<TodayPage />} />
          <Route path="ingredients" element={<IngredientsPage />} />
          <Route path="ingredients/:id" element={<IngredientDetailPage />} />
          <Route path="recipes" element={<RecipesPage />} />
          <Route path="recipes/:id" element={<RecipeDetailPage />} />
          <Route path="pantry" element={<PantryPage />} />
          <Route path="cook" element={<CookPage />} />
          <Route path="plan" element={<PlanPage />} />
          <Route path="shopping" element={<ShoppingPage />} />
          <Route path="log" element={<LogPage />} />
          <Route path="insights" element={<InsightsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="more" element={<MorePage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
