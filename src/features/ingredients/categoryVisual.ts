import {
  Beef,
  Circle,
  Droplets,
  Leaf,
  Milk,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import {
  DEFAULT_CATEGORY_ACCENT,
  DEFAULT_CATEGORY_ICON,
  type IngredientCategory,
} from "@/domain";

/** Lucide components keyed by the string names stored on categories (ADR-002). */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Leaf,
  Beef,
  Milk,
  Wheat,
  Droplets,
  Circle,
};

const ACCENT_TOKEN = /^--[a-zA-Z][\w-]*$/;

export type CategoryVisual = {
  icon: LucideIcon;
  /** CSS custom-property name, e.g. `--color-success`. */
  accent: string;
};

export function resolveCategoryIcon(name: string | null | undefined): LucideIcon {
  if (name && CATEGORY_ICONS[name]) return CATEGORY_ICONS[name]!;
  return CATEGORY_ICONS[DEFAULT_CATEGORY_ICON] ?? Circle;
}

export function resolveCategoryAccent(
  accent: string | null | undefined,
): string {
  if (accent && ACCENT_TOKEN.test(accent)) return accent;
  return DEFAULT_CATEGORY_ACCENT;
}

export function resolveCategoryVisual(
  category: IngredientCategory | null | undefined,
): CategoryVisual {
  return {
    icon: resolveCategoryIcon(category?.icon),
    accent: resolveCategoryAccent(category?.accent),
  };
}
