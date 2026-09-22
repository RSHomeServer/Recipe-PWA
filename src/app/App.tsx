import { useEffect } from "react";
import { SoloSiteApp } from "@songara/pwa-base";
import { ThemeProvider } from "@songara/pwa-base/ui";
import { BrowserRouter } from "react-router-dom";
import { recipeSite } from "@/app/site";
import { openRecipeDb } from "@/data";
import { Toaster } from "@/ui/sonner";

export function App() {
  useEffect(() => {
    void openRecipeDb().catch((err: unknown) => {
      console.error("Failed to open Recipe database", err);
    });
  }, []);

  return (
    <ThemeProvider>
      <BrowserRouter>
        <SoloSiteApp site={recipeSite} />
        <Toaster />
      </BrowserRouter>
    </ThemeProvider>
  );
}
