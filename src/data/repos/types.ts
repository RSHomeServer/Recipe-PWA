import type {
  Batch,
  BatchUpdate,
  Ingredient,
  IngredientCategory,
  LoggedMeal,
  MealSlot,
  MealTemplate,
  PantryStock,
  PlannedMeal,
  Recipe,
  RecipeImage,
  Settings,
  ShoppingOverlay,
} from "@/domain";

export interface IngredientRepo {
  all(): Promise<Ingredient[]>;
  byId(id: string): Promise<Ingredient | undefined>;
  put(row: Ingredient): Promise<void>;
  archive(id: string, archivedAt: string): Promise<void>;
}

export interface IngredientCategoryRepo {
  all(): Promise<IngredientCategory[]>;
  byId(id: string): Promise<IngredientCategory | undefined>;
  put(row: IngredientCategory): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface RecipeRepo {
  all(): Promise<Recipe[]>;
  byId(id: string): Promise<Recipe | undefined>;
  put(row: Recipe): Promise<void>;
  archive(id: string, archivedAt: string): Promise<void>;
}

export interface RecipeImageRepo {
  byId(id: string): Promise<RecipeImage | undefined>;
  put(row: RecipeImage): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface BatchRepo {
  all(): Promise<Batch[]>;
  byId(id: string): Promise<Batch | undefined>;
  byRecipeId(recipeId: string): Promise<Batch[]>;
  /** Insert a new batch. Fails if id already exists. */
  create(row: Batch): Promise<void>;
  /**
   * Update mutable fields. Rejects if `snapshot` is present on the patch or if
   * a full put would change the stored snapshot.
   */
  update(id: string, patch: BatchUpdate): Promise<void>;
  /**
   * Put for create-or-replace of non-snapshot fields only when the row exists:
   * creating is allowed; mutating an existing snapshot throws.
   */
  put(row: Batch): Promise<void>;
}

export interface PantryStockRepo {
  all(): Promise<PantryStock[]>;
  byIngredientId(ingredientId: string): Promise<PantryStock | undefined>;
  put(row: PantryStock): Promise<void>;
  delete(ingredientId: string): Promise<void>;
}

export interface MealSlotRepo {
  all(): Promise<MealSlot[]>;
  byId(id: string): Promise<MealSlot | undefined>;
  put(row: MealSlot): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface MealTemplateRepo {
  all(): Promise<MealTemplate[]>;
  byId(id: string): Promise<MealTemplate | undefined>;
  put(row: MealTemplate): Promise<void>;
  archive(id: string, archivedAt: string): Promise<void>;
}

export interface PlannedMealRepo {
  all(): Promise<PlannedMeal[]>;
  byId(id: string): Promise<PlannedMeal | undefined>;
  byDate(date: string): Promise<PlannedMeal[]>;
  put(row: PlannedMeal): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface LoggedMealRepo {
  all(): Promise<LoggedMeal[]>;
  byId(id: string): Promise<LoggedMeal | undefined>;
  byDate(date: string): Promise<LoggedMeal[]>;
  put(row: LoggedMeal): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface ShoppingOverlayRepo {
  all(): Promise<ShoppingOverlay[]>;
  byId(id: string): Promise<ShoppingOverlay | undefined>;
  byWindowKey(windowKey: string): Promise<ShoppingOverlay | undefined>;
  put(row: ShoppingOverlay): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface SettingsRepo {
  get(): Promise<Settings>;
  put(row: Settings): Promise<void>;
}

export interface RecipeRepositories {
  ingredients: IngredientRepo;
  ingredientCategories: IngredientCategoryRepo;
  recipes: RecipeRepo;
  recipeImages: RecipeImageRepo;
  batches: BatchRepo;
  pantryStock: PantryStockRepo;
  mealSlots: MealSlotRepo;
  mealTemplates: MealTemplateRepo;
  plannedMeals: PlannedMealRepo;
  loggedMeals: LoggedMealRepo;
  shoppingOverlays: ShoppingOverlayRepo;
  settings: SettingsRepo;
}
