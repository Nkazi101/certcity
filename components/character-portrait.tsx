"use client";

import { useEffect, useState } from "react";

const rendered = new Map<string, string>();

if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  // Development aid: `await __certcityPortrait("nia")` returns the studio render as a data URL.
  (window as Window & { __certcityPortrait?: (id: string) => Promise<string> }).__certcityPortrait =
    (id) => import("../lib/scene/portrait-studio").then(({ renderPortrait }) => renderPortrait(id));
}

/**
 * A person's portrait rendered from the city's character models (see lib/scene/portrait-studio.ts). The older shared-body
 * images remain as the fallback when WebGL or the model is unavailable.
 */
export function CharacterPortrait({ id, className, width = 360, height = 416 }: { id: string; className?: string; width?: number; height?: number }) {
  const fallback = `/models/portraits/${id}.webp`;
  const [source, setSource] = useState<{ id: string; src: string; kind: "studio" | "fallback" } | null>(() => {
    const cached = rendered.get(id);
    return cached ? { id, src: cached, kind: "studio" } : null;
  });

  useEffect(() => {
    let live = true;
    const cached = rendered.get(id);
    if (cached) {
      setSource({ id, src: cached, kind: "studio" });
      return;
    }
    import("../lib/scene/portrait-studio")
      .then(({ renderPortrait }) => renderPortrait(id))
      .then((src) => {
        rendered.set(id, src);
        if (live) setSource({ id, src, kind: "studio" });
      })
      .catch(() => {
        if (live) setSource({ id, src: fallback, kind: "fallback" });
      });
    return () => { live = false; };
  }, [id, fallback]);

  const current = source?.id === id ? source : null;
  return (
    <img className={className} src={current?.src ?? "data:image/gif;base64,R0lGODlhAQABAAAAACw="} alt="" width={width} height={height}
      data-portrait={current?.kind ?? "loading"}
      style={{ opacity: current ? 1 : 0, transition: "opacity .25s ease" }} />
  );
}
