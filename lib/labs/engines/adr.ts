// Architecture decision record replayed as a pilot (provider-neutral). The learner's ADR names the first change, who
// holds issuance authority, what applicants may see, the route's cost per 100 resolved cases, the rollout scope with
// its stop rule, and the alternatives weighed. The replay runs an incomplete application through the chosen design,
// checks the stated cost against a month of invoices, plays an unpublished status change, rolls the pilot out week by
// week against the weak slice's accuracy, and asks the sponsor's question.
import { markdownSections, section } from "./parse";
import type { Engine, EngineRun, Fixture, TraceEvent, TraceSource } from "../types";

export type PilotOption = { id: string; pattern: string; label: string; removesWait: boolean };
export type AdrInput = {
  options: readonly PilotOption[];
  waitDays: number;
  application: string;
  cost: { first: number; retryShare: number; retry: number; otherRoute: number };
  decider: string;
  unpublished: string;
  rollout: { offices: number; slice: string; slicePattern: string; bound: number; weeks: readonly { week: number; accuracy: number }[]; expandWeek: number };
  sponsorAsk: { option: string; question: string };
};

type Parsed = { text: string; sections: Map<string, string> };

export type AdrOut = {
  decision: PilotOption | null;
  waitDays: number;
  issuedBy: "staff" | "model" | "unclear";
  stated: number | null;
  invoiced: number;
  disclosed: boolean;
  rollout: { offices: number; haltWeek: number | null; reachedAll: boolean; failingWeek: number | null; ruleSeen: boolean };
  sponsor: { named: boolean; reasoned: boolean };
  sources: Record<"decision" | "authority" | "cost" | "disclosure" | "rollout" | "alternatives", TraceSource>;
};

const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };

function lineOf(textValue: string, heading: string): TraceSource {
  const index = textValue.split("\n").findIndex((line) => /^#{1,6}\s/.test(line) && line.toLowerCase().includes(heading));
  return { artifact: "adr", line: index >= 0 ? index + 1 : 1 };
}

export const adrEngine: Engine<Parsed, AdrInput, AdrOut> = {
  id: "neutral.adr-pilot",
  provider: "neutral",
  label: "ADR replayed as a pilot: an incomplete application, a month of invoices, a status change, the rollout weeks and the sponsor’s review",
  simulated: false,
  parse(files) {
    const textValue = files.adr ?? "";
    const sections = markdownSections(textValue);
    if (sections.size < 2) return { ok: false, error: "adr.md needs ## sections (Decision, Alternatives, Authority, Disclosure, Cost, Rollout) for the replay to read.", source: { artifact: "adr", line: 1 } };
    return { ok: true, value: { text: textValue, sections } };
  },
  run({ text: adr, sections }, fixture: Fixture<AdrInput>): EngineRun<AdrOut> {
    const input = fixture.input;
    const trace: TraceEvent[] = [];
    const push = (event: Omit<TraceEvent, "step">) => trace.push({ step: trace.length + 1, ...event });
    const read = (...keys: string[]) => keys.map((key) => section(sections, key)).find((body) => body !== null) ?? "";
    const sources = {
      decision: lineOf(adr, "decision"), authority: lineOf(adr, "authorit"), cost: lineOf(adr, "cost"),
      disclosure: lineOf(adr, "disclos"), rollout: lineOf(adr, "rollout"), alternatives: lineOf(adr, "alternativ"),
    };

    // 1. The first change, on an incomplete application.
    const decisionText = read("decision");
    const decision = input.options.map((option) => ({ option, at: decisionText.search(new RegExp(option.pattern, "i")) }))
      .filter(({ at }) => at >= 0).sort((left, right) => left.at - right.at)[0]?.option ?? null;
    const waitDays = decision?.removesWait ? 0 : input.waitDays;
    push({ actor: "person", kind: "request", label: `${input.application} arrives without a required attachment`, detail: decision ? `First change in the ADR: ${decision.label}` : "The Decision section names none of the options on the table.", source: sources.decision });
    push({ actor: "service", kind: "output", label: waitDays ? `It sits in the hold tray: ${waitDays} extra days until the attachment is chased` : "Flagged at submission; the applicant adds the attachment the same day", source: sources.decision, tone: waitDays ? "bad" : "ok" });

    // 2. Issuance authority.
    const authority = read("authorit", "issu");
    const clause = (pattern: RegExp) => [...authority.matchAll(pattern)].some(([match]) => !/\b(never|not|cannot|can’t|doesn’t|no)\b/i.test(match));
    const modelIssues = clause(/\b(model|claude|agent|assistant|ai|bot)\b[^.;,\n]*\b(issues?|approves?|decides?|grants?|signs?)\b/gi);
    const staffIssues = clause(/\b(licensed|named|staff|reviewer|clerk|inspector|officer|person)\b[^.;,\n]*\b(issues?|decides?|approves?|signs?|grants?)\b/gi);
    const issuedBy = modelIssues ? "model" as const : staffIssues ? "staff" as const : "unclear" as const;
    push({ actor: issuedBy === "staff" ? "person" : "model", kind: "decision", label: issuedBy === "staff" ? `A complete application is issued by the ${input.decider}, from the evidence the pilot prepared` : issuedBy === "model" ? "A complete application is issued by the pilot itself" : "Nobody in the ADR is named to issue; the pilot’s draft goes out as the decision",
      source: sources.authority, tone: issuedBy === "staff" ? "ok" : "bad" });

    // 3. Cost per 100 resolved cases against a month of invoices.
    const costText = read("cost");
    const cents = /(\d+(?:\.\d+)?)\s*(?:¢|c\b|cents?)/i.exec(costText);
    const dollars = /\$\s?(\d+(?:\.\d+)?)/.exec(costText);
    const stated = cents ? Number(cents[1]) : dollars ? Math.round(Number(dollars[1]) * 100) : null;
    const invoiced = Math.round((input.cost.first + input.cost.retryShare * input.cost.retry) * 100);
    const costMatches = stated !== null && Math.abs(stated - invoiced) <= invoiced * 0.02;
    push({ actor: "service", kind: "metric", label: `A month later, invoices for 100 resolved cases ${stated === null ? "have no ADR figure to compare with" : costMatches ? `match the ADR’s ${stated}¢` : `come to ${stated < invoiced ? "more" : "less"} than the ADR’s ${stated}¢`}`, source: sources.cost, tone: costMatches ? "ok" : "bad" });

    // 4. An unpublished status change.
    const disclosureText = read("disclos", "applicant", "status");
    const disclosed = !/publish|announc|released|formal/i.test(disclosureText) || /every (status )?(change|update)|all (status )?(changes|updates)|internal (notes?|review)[^.\n]*\b(shown|visible|see|share)/i.test(disclosureText);
    push({ actor: "service", kind: "output", label: `${input.unpublished} → ${disclosed ? "shown to the applicant" : "kept internal until the office publishes it"}`, source: sources.disclosure, tone: disclosed ? "bad" : "ok" });

    // 5. The rollout, week by week.
    const rolloutText = read("rollout", "stop");
    const count = /\b(\d+|one|two|three|four|five|six|seven|eight)\s+(?:pilot\s+)?(?:offices?|markets?|sites?|counters?|branches)\b/i.exec(rolloutText);
    const offices = /\ball\s+(offices|markets|sites|counters|branches)\b/i.test(rolloutText) && !count ? input.rollout.offices
      : count ? Math.min(input.rollout.offices, Number(words[count[1].toLowerCase()] ?? count[1])) : input.rollout.offices;
    const stopLines = rolloutText.split("\n").filter((line) => new RegExp(input.rollout.slicePattern, "i").test(line) && /stop|halt|pause|roll ?back|revert|withdraw/i.test(line));
    const threshold = stopLines.map((line) => /(\d+(?:\.\d+)?)\s*%/.exec(line)?.[1] ?? /\b0?\.(\d+)\b/.exec(line)?.[0]).filter(Boolean).map((value) => Number(value) > 1 ? Number(value) / 100 : Number(value))[0] ?? null;
    const ruleSeen = stopLines.length > 0 && threshold !== null;
    let haltWeek: number | null = null;
    let reachedAll = offices >= input.rollout.offices;
    const failingWeek = input.rollout.weeks.find(({ accuracy }) => accuracy < input.rollout.bound)?.week ?? null;
    push({ actor: "service", kind: "decision", label: `Week 1: the pilot starts at ${offices} of ${input.rollout.offices} offices`, source: sources.rollout, tone: reachedAll ? "warn" : undefined });
    for (const { week, accuracy } of input.rollout.weeks) {
      const fires = ruleSeen && accuracy < threshold!;
      push({ actor: "model", kind: "metric", label: `Week ${week}: ${input.rollout.slice} accuracy ${Math.round(accuracy * 100)}%${fires ? " → stop rule fires; the pilot rolls back to staff handling" : ""}`, source: sources.rollout, tone: accuracy < input.rollout.bound ? fires ? "ok" : "warn" : undefined });
      if (fires) { haltWeek = week; break; }
      if (week + 1 >= input.rollout.expandWeek && !reachedAll) {
        reachedAll = true;
        push({ actor: "service", kind: "decision", label: `Week ${week + 1}: no stop condition met; the pilot expands to all ${input.rollout.offices} offices`, source: sources.rollout, tone: failingWeek !== null && failingWeek <= week ? "bad" : undefined });
      }
    }

    // 6. The sponsor's question.
    const alternatives = read("alternativ", "option");
    const ask = input.options.find(({ id }) => id === input.sponsorAsk.option)!;
    const askLine = alternatives.split("\n").find((line) => new RegExp(ask.pattern, "i").test(line)) ?? "";
    const named = askLine.length > 0;
    const reasoned = named && /\d/.test(askLine) && /day|minute|min\b|hour|wait|¢|cent|\$|%/.test(askLine);
    push({ actor: "person", kind: "request", label: `Sponsor: “${input.sponsorAsk.question}”`, detail: named ? `The ADR answers: ${askLine.replace(/^[-*]\s*/, "").trim()}` : "The ADR does not mention it.", source: sources.alternatives, tone: reasoned ? "ok" : "bad" });

    return {
      trace,
      out: { decision, waitDays, issuedBy, stated, invoiced, disclosed, rollout: { offices, haltWeek, reachedAll, failingWeek, ruleSeen }, sponsor: { named, reasoned }, sources },
      metrics: { waitDays },
    };
  },
};
