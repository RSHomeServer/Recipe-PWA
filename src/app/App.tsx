import { SoloSiteApp } from "@songara/pwa-base";
import { ThemeProvider } from "@songara/pwa-base/ui";
import { BrowserRouter } from "react-router-dom";
import { recipeSite } from "@/app/site";
import { RecipeDataProvider } from "@/data";
import { Toaster } from "@/ui/sonner";

export function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <RecipeDataProvider>
          <SoloSiteApp site={recipeSite} />
          <Toaster />
        </RecipeDataProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
