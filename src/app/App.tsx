import { SoloSiteApp } from "@songara/pwa-base";
import { ThemeProvider } from "@songara/pwa-base/ui";
import { BrowserRouter } from "react-router-dom";
import { recipeSite } from "@/app/site";
import { Toaster } from "@/ui/sonner";

export function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <SoloSiteApp site={recipeSite} />
        <Toaster />
      </BrowserRouter>
    </ThemeProvider>
  );
}
