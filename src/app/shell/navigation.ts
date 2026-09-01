export type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: string;
};

export const primaryNavItems: NavItem[] = [
  { id: "today", label: "Today", href: "/", icon: "☀" },
  { id: "plan", label: "Plan", href: "/plan", icon: "📅" },
  { id: "shop", label: "Shop", href: "/shopping", icon: "🛒" },
  { id: "log", label: "Log", href: "/log", icon: "✎" },
  { id: "more", label: "More", href: "/more", icon: "⋯" },
];

export const secondaryNavItems: NavItem[] = [
  { id: "ingredients", label: "Ingredients", href: "/ingredients", icon: "◆" },
  { id: "recipes", label: "Recipes", href: "/recipes", icon: "📖" },
  { id: "pantry", label: "Pantry", href: "/pantry", icon: "🏠" },
  { id: "cook", label: "Batches", href: "/cook", icon: "🍳" },
  { id: "insights", label: "Insights", href: "/insights", icon: "📊" },
  { id: "settings", label: "Settings", href: "/settings", icon: "⚙" },
];

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/more") return pathname === "/more";
  return pathname === href || pathname.startsWith(`${href}/`);
}
