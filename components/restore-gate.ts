"use client";

import { useLayoutEffect } from "react";
import { expectedRestores, restoreAttribute, restoreTimeoutMs } from "../lib/restore-gate";
import type { RestoreScope } from "../lib/restore-gate";

const pending: Record<RestoreScope, Set<symbol>> = { progress: new Set(), route: new Set() };
let hydrated = false;
let scheduled = false;
let failsafe: number | undefined;

function activeScopes() {
  return new Set((document.documentElement.getAttribute(restoreAttribute) ?? "").split(" ").filter(Boolean));
}

function writeScopes(scopes: Set<string>) {
  if (scopes.size) document.documentElement.setAttribute(restoreAttribute, [...scopes].join(" "));
  else document.documentElement.removeAttribute(restoreAttribute);
}

/**
 * Lifts every scope that no mounted restorer is still waiting on. It runs as a microtask so it sees the whole commit:
 * one restorer can hand off to another (a loading fallback to the component it loads) without the veil dropping between.
 */
function settle() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    const scopes = activeScopes();
    for (const scope of scopes) if (!pending[scope as RestoreScope]?.size) scopes.delete(scope);
    writeScopes(scopes);
  });
}

/** Called once the first client render has committed. Later mounts come from client-side navigation. */
export function markHydrated() {
  hydrated = true;
}

/**
 * Keeps `scope` veiled until this component has restored its client-only state (`settled`). See lib/restore-gate.ts.
 *
 * During hydration, only the pre-paint script decides whether to veil: it ran before the prerendered HTML painted.
 * After hydration (a client-side navigation), this component may mount before its state is known, so it raises the
 * veil itself, before paint, when this browser has that kind of state to restore.
 */
export function useRestoreGate(scope: RestoreScope, settled: boolean) {
  useLayoutEffect(() => {
    if (settled) {
      settle();
      return;
    }
    const token = Symbol(scope);
    pending[scope].add(token);
    if (hydrated) {
      const scopes = activeScopes();
      if (!scopes.has(scope) && expectedRestores().split(" ").includes(scope)) {
        scopes.add(scope);
        writeScopes(scopes);
        window.clearTimeout(failsafe);
        failsafe = window.setTimeout(() => document.documentElement.removeAttribute(restoreAttribute), restoreTimeoutMs);
      }
    }
    return () => {
      pending[scope].delete(token);
      settle();
    };
  }, [scope, settled]);
}
