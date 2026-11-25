/**
 * Which captured city poster matches the light the 3D city will open in. The poster dissolves into the live scene
 * (app/globals.css), so it must show the same time of day: the visitor's saved time-of-day choice, or in "auto" the
 * local hour, matched to the nearest look on the renderer's day curve (lib/scene/sky.ts keys).
 *
 * Posters: night (flat from 22:30 to 05:06), dawn (06:42), day (12:30; the 09:00–16:00 plateau), dusk (18:21) and
 * twilight (19:54). "auto" switches at the midpoints between those keys. Re-capture the posters if the keys change.
 */
export type CityLight = "night" | "dawn" | "day" | "dusk" | "twilight";

export const cityLightAttribute = "data-city-light";

/**
 * Serialized verbatim into the pre-paint script, so it must stay self-contained: no imports, no references to anything
 * outside its body. The storage key and presets mirror components/world-ambience.tsx and lib/scene/sky.ts.
 */
export function cityLight(): string {
  var mode = "auto";
  try {
    mode = window.localStorage.getItem("certcity.time-of-day.v1") || "auto";
  } catch (error) {
    // Storage unavailable: the city opens in auto.
  }
  if (mode === "dawn" || mode === "day" || mode === "dusk" || mode === "night") return mode;
  var now = new Date();
  var hour = now.getHours() + now.getMinutes() / 60;
  if (hour < 5.9 || hour >= 21.2) return "night";
  if (hour < 7.85) return "dawn";
  if (hour < 17.2) return "day";
  if (hour < 19.1) return "dusk";
  return "twilight";
}

/** Marks <html data-city-light> before first paint so the matching poster is the first one requested and shown. */
export const cityLightScript = `(function(){try{document.documentElement.setAttribute(${JSON.stringify(cityLightAttribute)},` +
  `(${cityLight.toString()})())}catch(e){}})()`;
