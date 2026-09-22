import { defineSite, SITE_CAPABILITY } from "@songara/pwa-base/contract";
import { AppShell } from "@/app/shell/AppShell";

export const recipeSite = defineSite({
  id: "recipe",
  basePath: "/",
  title: "Recipe",
  capabilities: [SITE_CAPABILITY.offline],
  routes: [{ path: "*", component: AppShell }],
});
