"use client";

import { createElement } from "react";
import { cityLightScript } from "../lib/city-light";
import { restoreScript } from "../lib/restore-gate";

/**
 * Corrects the prerendered page for this browser before first paint: veils state about to be restored
 * (lib/restore-gate.ts) and picks the city poster for the light the city will open in (lib/city-light.ts).
 *
 * The server renders a script that runs during HTML parsing; the client renders it inert (text/plain), since React
 * never runs scripts it renders and warns when asked to.
 */
export function PrePaintScript() {
  return createElement("script", {
    type: typeof window === "undefined" ? "text/javascript" : "text/plain",
    suppressHydrationWarning: true,
    dangerouslySetInnerHTML: { __html: `${restoreScript};${cityLightScript}` },
  });
}
