import type { MealTemplateComponent } from "@/domain";

/** Router location state when opening /meals/new from “Save these as a meal”. */
export type SaveAsMealLocationState = {
  saveAsMeal?: {
    components: MealTemplateComponent[];
    defaultSlotId: string;
  };
};
