// Claim verification (provider-neutral): the learner's Claim | Source | Verdict | Fix table is applied to Claude's
// draft replies, and the engine shows what each family would receive. Verdicts and fixes are read structurally from
// the table (generalizing the Associate capstone's checklist grader), so what goes out follows from what was written.
import { column, findTable } from "./parse";
import type { Engine, EngineRun, Fixture, TraceEvent, TraceSource } from "../types";

export type Truth = "supported" | "incorrect" | "unsupported" | "decision";
export type DraftClaim = {
  id: string;
  /** Who the reply goes to. */
  reply: string;
  /** The sentence as Claude drafted it. */
  text: string;
  /** Words that identify this claim's row (all must appear in the Claim cell). */
  match: readonly string[];
  truth: Truth;
  /** The source that settles it, and sources that must not be cited for it. */
  source?: { name: string; must: string; not?: string };
  /** The value the signed source gives (incorrect claims). */
  correct?: string;
  /** Who decides (decision claims) and what they must receive. */
  owner?: string;
};
export type ClaimInput = { claims: readonly DraftClaim[] };

export type Verdict = Truth | null;
export type ClaimOut = {
  table: boolean;
  rows: readonly {
    claim: DraftClaim;
    found: boolean;
    verdict: Verdict;
    citesSource: boolean;
    fixValue: string | null;
    removes: boolean;
    routesToOwner: boolean;
    withReason: boolean;
    /** What the family receives for this claim. */
    sent: string;
    source: TraceSource;
  }[];
};

const datePattern = /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2}\b/i;

/** Verdict words, most specific first. A cell that names several verdicts reads as the first of them. */
export function classifyVerdict(cell: string): Verdict {
  const value = cell.toLowerCase();
  if (/unsupported|not supported|no source|unverified|not in (the )?source|no evidence/.test(value)) return "unsupported";
  if (/incorrect|wrong|false|contradict|mismatch|inaccurate|outdated/.test(value)) return "incorrect";
  if (/decision|decide|human|escalat|approval|lead|owner/.test(value)) return "decision";
  if (/supported|correct|accurate|\bok\b|verified|matches|confirmed/.test(value)) return "supported";
  return null;
}

export const claimTableEngine: Engine<{ text: string }, ClaimInput, ClaimOut> = {
  id: "neutral.claim-table",
  provider: "neutral",
  label: "Claim checklist applied to the drafted replies",
  simulated: false,
  parse(files) {
    const text = files.checklist ?? "";
    if (!findTable(text, ["claim", "verdict"])) return { ok: false, error: "checklist.md has no Markdown table with Claim and Verdict columns (a header row, a |---| row, then one row per claim).", source: { artifact: "checklist", line: 1 } };
    return { ok: true, value: { text } };
  },
  run({ text }, fixture: Fixture<ClaimInput>): EngineRun<ClaimOut> {
    const table = findTable(text, ["claim", "verdict"])!;
    const lines = text.split("\n");
    const trace: TraceEvent[] = [];
    const push = (event: Omit<TraceEvent, "step">) => trace.push({ step: trace.length + 1, ...event });
    push({ actor: "learner-artifact", kind: "request", label: `checklist.md · ${table.rows.length} rows`, source: { artifact: "checklist", line: 1 } });
    const rows = fixture.input.claims.map((claim) => {
      const row = table.rows.find((entry) => claim.match.every((word) => column(entry, "claim").toLowerCase().includes(word.toLowerCase())));
      const lineIndex = row ? lines.findIndex((line) => line.trim().startsWith("|") && claim.match.every((word) => line.toLowerCase().includes(word.toLowerCase()))) : -1;
      const source: TraceSource = { artifact: "checklist", line: lineIndex >= 0 ? lineIndex + 1 : 1 };
      const verdict = row ? classifyVerdict(column(row, "verdict")) : null;
      const cited = row ? column(row, "source") : "";
      const fix = row ? column(row, "fix") : "";
      const citesSource = !!claim.source && new RegExp(claim.source.must, "i").test(cited) && !(claim.source.not && new RegExp(claim.source.not, "i").test(cited));
      const fixValue = datePattern.exec(fix)?.[0] ?? null;
      const removes = /remove|delete|drop|cut|pending|not (yet )?(announced|set|known|confirmed)|unknown|to be announced|tbd|confirm (it )?later/i.test(fix);
      const routesToOwner = !!claim.owner && new RegExp(claim.owner.split(" ")[0], "i").test(fix) && /hold|send|forward|route|pass|refer|queue|give/i.test(fix);
      const withReason = /reason/i.test(fix);
      // What goes out, following the row as written.
      let sent = claim.text;
      if (verdict === "decision" && routesToOwner) sent = `(held for ${claim.owner})`;
      else if (verdict === "incorrect" || verdict === "unsupported") {
        if (fixValue) sent = claim.text.replace(datePattern, fixValue);
        else if (/pending|not (yet )?(announced|set|known|confirmed)|unknown|to be announced|tbd|confirm (it )?later/i.test(fix)) sent = "(not yet announced; the office will confirm)";
        else if (removes) sent = "(sentence removed)";
        else sent = verdict === "unsupported" ? "(sentence removed)" : claim.text;
      } else if (verdict === "decision") sent = claim.text;
      push({ actor: "model", kind: "output", label: `Draft to ${claim.reply}: “${claim.text}”`, detail: row
        ? `Your row: ${column(row, "verdict") || "(no verdict)"} · source: ${cited || "(none)"} · fix: ${fix || "(none)"}`
        : "No row checks this sentence.", source });
      push({ actor: "person", kind: "output", label: `${claim.reply} receives: ${sent}`,
        tone: sent === claim.text && claim.truth !== "supported" ? "bad" : sent !== claim.text && claim.truth === "supported" ? "bad" : undefined });
      return { claim, found: !!row, verdict, citesSource, fixValue, removes, routesToOwner, withReason, sent, source };
    });
    return { trace, out: { table: true, rows }, metrics: { wrongOut: rows.filter(({ claim, sent }) => claim.truth !== "supported" && sent === claim.text).length } };
  },
};
