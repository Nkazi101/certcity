export const conditions = [
  { id: "empty", name: "No matches", count: 120, actions: ["noMatch", "repeat", "review"] },
  { id: "timeout", name: "Temporary timeout", count: 100, actions: ["noMatch", "retry", "review"] },
  { id: "invalid", name: "Invalid order ID", count: 40, actions: ["noMatch", "clarify", "review"] },
  { id: "denied", name: "Permission denied", count: 20, actions: ["noMatch", "deny", "review"] },
] as const;

export const routeLabels = {
  noMatch: "Reply no match",
  repeat: "Repeat once",
  retry: "Retry once, then hand off",
  clarify: "Ask for a corrected ID",
  deny: "Deny safely",
  review: "Send to support",
} as const;

export type Contract = "baseline" | "blanket" | "typed";
export const contractLabels: Record<Contract, string> = {
  baseline: "Single fallback",
  blanket: "Retry every non-hit",
  typed: "Route by outcome",
};
export type Route = keyof typeof routeLabels;
export type Condition = (typeof conditions)[number]["id"];
export type Routes = Record<Condition, Route>;

export const initialRoutes: Routes = {
  empty: "noMatch",
  timeout: "noMatch",
  invalid: "noMatch",
  denied: "noMatch",
};

export function runShift(contract: Contract, routes: Routes) {
  let calls = 1000;
  let followUps = 0;
  let falseNoMatches = 0;

  for (const { id, count } of conditions) {
    if (contract === "blanket") calls += count;
    if (contract !== "typed") {
      const wrong = id === "empty" ? 0 : id === "timeout" && contract === "blanket" ? 20 : count;
      followUps += wrong;
      falseNoMatches += wrong;
      continue;
    }

    switch (routes[id]) {
      case "noMatch":
        if (id !== "empty") {
          followUps += count;
          falseNoMatches += count;
        }
        break;
      case "repeat":
        calls += count;
        break;
      case "retry":
        calls += count;
        followUps += 20;
        break;
      case "clarify":
        calls += 30;
        followUps += 10;
        break;
      case "review":
        followUps += count;
        break;
      case "deny":
        break;
    }
  }

  return {
    calls,
    falseNoMatches,
    staffHours: followUps / 10,
    directSpend: calls * 0.002 + (contract === "typed" ? 10 : 0),
  };
}

export type ShiftResult = ReturnType<typeof runShift>;

export const baselineShift = runShift("baseline", initialRoutes);

export function shiftImpact(result: ShiftResult) {
  return {
    hoursSaved: baselineShift.staffHours - result.staffHours,
    falseRepliesAvoided: baselineShift.falseNoMatches - result.falseNoMatches,
    spendSaved: Math.round((baselineShift.directSpend - result.directSpend) * 100) / 100,
  };
}

export function meetsDispatchGoal(result: ShiftResult) {
  return result.falseNoMatches === 0 && result.staffHours < baselineShift.staffHours;
}

export function traceOutcome(contract: Contract, routes: Routes) {
  const route = routes[sampleTicket.condition];
  const appliedRule = contract === "typed" ? routeLabels[route] : contractLabels[contract];
  if (contract === "blanket" || (contract === "typed" && route === "retry")) {
    return {
      target: "reply",
      disposition: "Shipment status returned",
      rule: appliedRule,
      message: "The retry succeeds. The customer receives their shipment status.",
    };
  }
  if (contract === "typed" && route === "review") {
    return {
      target: "support",
      disposition: "Routed to the support desk",
      rule: appliedRule,
      message: "The support desk receives the ticket and the timeout record.",
    };
  }
  return {
    target: "reply",
    disposition: "“Order not found”",
    rule: appliedRule,
    message: "The assistant sends a false “Order not found” reply. The timed-out lookup never established whether the order exists.",
  };
}

export const sampleTicket = {
  id: "T-17",
  request: "A customer has a tracking number and asks where the shipment is.",
  source: "The lookup gateway timed out before it returned any rows.",
  code: "TIMEOUT",
  condition: "timeout",
} as const;

export type DispatchPolicy = { contract: Contract; routes: Routes };

export function parseDispatchPolicy(saved: unknown): DispatchPolicy | null {
  if (!saved || typeof saved !== "object") return null;
  const { contract, routes } = saved as { contract?: unknown; routes?: Record<string, unknown> };
  if (contract !== "baseline" && contract !== "blanket" && contract !== "typed") return null;
  if (!routes || typeof routes !== "object") return null;
  const valid = { ...initialRoutes };
  for (const { id, actions } of conditions) {
    const route = routes[id];
    if (!actions.some((action) => action === route)) return null;
    valid[id] = route as Route;
  }
  return { contract, routes: valid };
}
