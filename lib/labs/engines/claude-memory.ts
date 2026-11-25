// Claude Code memory replay: which instruction files load in each recorded session, on which machine. User scope
// (~/.claude/CLAUDE.md) loads only on its owner's machine; the project CLAUDE.md and rules without `paths` load at launch on
// every checkout; a rule with `paths` loads when Claude reads or edits a matching file (globs relative to the project root);
// a rule whose frontmatter fails to parse loads as if it had no `paths`. A project Skill is invoked as /<name> (name field,
// else its folder); `disable-model-invocation: true` keeps Claude from starting it on its own; `user-invocable: false`
// hides it from the / menu. Files a Skill points to must exist on the machine running it.
import { frontmatterList, globRegex, parseFrontmatter, record } from "./parse";
import type { Engine, EngineRun, Fixture, TraceEvent, TraceSource } from "../types";

export type MemoryTouch = { path: string; proof: boolean };
export type MemorySession = {
  id: string; at: string; who: string;
  machine: "owner" | "clean";
  prompt: string;
  /** A slash command the operator types, e.g. "/release-proofs 4471". */
  command?: string;
  touches: readonly MemoryTouch[];
  /** For a release: the order and product the proof is saved for. */
  release?: { order: string; product: string; rev: number };
  /** The session's question is about a finished proof, so Claude may reach for a model-invocable release Skill. */
  tempts?: boolean;
};
export type MemoryInput = {
  owner: string;
  /** The owner's ~/.claude/CLAUDE.md, loaded on the owner's machine only. */
  userClaude: string;
  /** Files in the owner's home directory (not on a clean checkout). */
  ownerHome: readonly string[];
  /** Tracked files every checkout has. */
  checkout: readonly string[];
  skillCommand: string;
  checklist: readonly { label: string; pattern: string }[];
  patterns: { convention: string; personal: string; paper: string; example: string };
  sessions: readonly MemorySession[];
};

export type SessionMemory = {
  id: string; at: string; who: string; machine: "owner" | "clean"; prompt: string;
  launch: readonly string[];
  convention: boolean;
  personal: string | null;
  paperAtLaunch: string | null;
  touches: readonly (MemoryTouch & { paper: readonly string[] })[];
  release?: { resolved: boolean; problem?: string; proofName: string; skipped: readonly string[]; example: { path: string; reachable: boolean } | null };
  autoRelease: boolean;
};
export type MemoryOut = { sessions: readonly SessionMemory[]; sources: { claude: TraceSource; rule: TraceSource; skill: TraceSource } };

type Parsed = { claude: string; rule: { text: string; paths: string[] | null; error?: string }; skill: { text: string; data: Record<string, unknown>; body: string; error?: string } };

const files = { claude: "CLAUDE.md", rule: ".claude/rules/proofs.md", skill: ".claude/skills/release-proofs/SKILL.md" };
const skillDir = ".claude/skills/release-proofs";
const regex = (pattern: string) => new RegExp(pattern, "i");

export const claudeMemoryEngine: Engine<Parsed, MemoryInput, MemoryOut> = {
  id: "claude-code.memory-replay",
  provider: "anthropic",
  label: "Claude Code memory replay · CLAUDE.md scopes · path-scoped rules · project Skills",
  simulated: false,
  parse(input) {
    if (!(input.claude ?? "").trim()) return { ok: false, error: "CLAUDE.md is empty.", source: { artifact: "claude", line: 1 } };
    if (!(input.skill ?? "").trim()) return { ok: false, error: "SKILL.md is empty.", source: { artifact: "skill", line: 1 } };
    const rule = parseFrontmatter(input.rule);
    const skill = parseFrontmatter(input.skill);
    const paths = rule.present && !rule.error && Object.hasOwn(rule.data, "paths") ? frontmatterList(rule.data.paths) : null;
    return { ok: true, value: {
      claude: input.claude,
      rule: { text: input.rule ?? "", paths, error: rule.error },
      skill: { text: input.skill, data: skill.error ? {} : skill.data, body: skill.body, error: skill.error ?? (skill.present ? undefined : "SKILL.md has no frontmatter between --- lines.") },
    } };
  },
  run(parsed, fixture: Fixture<MemoryInput>): EngineRun<MemoryOut> {
    const input = fixture.input;
    const trace: TraceEvent[] = [];
    const push = (event: Omit<TraceEvent, "step">) => trace.push({ step: trace.length + 1, ...event });
    const lineIn = (artifact: string, value: string, pattern: RegExp): TraceSource => {
      const index = value.split("\n").findIndex((line) => pattern.test(line));
      return { artifact, line: index < 0 ? 1 : index + 1 };
    };
    const sources = { claude: { artifact: "claude", line: 1 }, rule: lineIn("rule", parsed.rule.text, /^\s*paths\s*:|^---/), skill: { artifact: "skill", line: 1 } };
    const conventionRe = regex(input.patterns.convention);
    const personalRe = regex(input.patterns.personal);
    const paperRe = regex(input.patterns.paper);
    const ruleBody = parsed.rule.text;
    const conditional = parsed.rule.paths !== null && parsed.rule.paths.length > 0;
    const ruleMatches = (path: string) => conditional && parsed.rule.paths!.some((glob) => {
      const pattern = glob.replace(/^\.?\//, "");
      try {
        return globRegex(pattern).test(path);
      } catch {
        return false;
      }
    });

    // --- the project Skill as Claude Code sees it ---
    const data = record(parsed.skill.data) ?? {};
    const name = typeof data.name === "string" && data.name.trim() ? data.name.trim() : skillDir.split("/").pop()!;
    const manualOnly = data["disable-model-invocation"] === true || data["disable-model-invocation"] === "true";
    const hidden = data["user-invocable"] === false || data["user-invocable"] === "false";
    const skillLoaded = !parsed.skill.error;
    const body = parsed.skill.body;
    const exampleRe = regex(input.patterns.example);
    const exampleRef = (body.match(/[~\w./-]*approved-example\.md/g) ?? []).find((ref) => exampleRe.test(ref)) ?? null;
    const resolveExample = (machine: "owner" | "clean") => {
      if (!exampleRef) return null;
      const home = exampleRef.startsWith("~/");
      const path = home ? exampleRef : exampleRef.startsWith(".claude/") ? exampleRef : `${skillDir}/${exampleRef.replace(/^\.\//, "")}`;
      const reachable = home ? machine === "owner" && input.ownerHome.includes(exampleRef) : input.checkout.includes(path);
      return { path: exampleRef, reachable };
    };

    const sessions = input.sessions.map((session): SessionMemory => {
      const launch: string[] = [];
      const loaded: { file: string; text: string }[] = [];
      if (session.machine === "owner") {
        launch.push(`~/.claude/CLAUDE.md (${input.owner})`);
        loaded.push({ file: "~/.claude/CLAUDE.md", text: input.userClaude });
      }
      launch.push(files.claude);
      loaded.push({ file: files.claude, text: parsed.claude });
      if (!conditional) {
        launch.push(`${files.rule}${parsed.rule.error ? " (frontmatter did not parse, so it loads everywhere)" : ""}`);
        loaded.push({ file: files.rule, text: ruleBody });
      }
      const atLaunch = (pattern: RegExp) => loaded.find(({ text }) => pattern.test(text))?.file ?? null;
      const convention = !!atLaunch(conventionRe);
      const personal = session.machine === "clean" ? atLaunch(personalRe) : null;
      const paperAtLaunch = atLaunch(paperRe);
      push({ actor: "person", kind: "request", label: `${session.at} · ${session.who} · ${session.machine === "clean" ? "clean checkout" : `${input.owner}’s machine`} · “${session.prompt}”`,
        detail: `Loaded at launch: ${launch.join(", ")}` });
      if (personal) push({ actor: "learner-artifact", kind: "decision", label: `Loaded for ${session.who}: “${(loaded.find(({ file }) => file === personal)!.text.split("\n").find((line) => personalRe.test(line)) ?? "").replace(/^[-*\s]+/, "")}”`, source: personal === files.claude ? lineIn("claude", parsed.claude, personalRe) : lineIn("rule", ruleBody, personalRe), tone: "bad" });

      // --- slash command ---
      let release: SessionMemory["release"];
      if (session.command && session.release) {
        const typed = session.command.split(/\s+/)[0].slice(1);
        const problem = !skillLoaded ? `${files.skill} did not load: ${parsed.skill.error}`
          : hidden ? `the Skill is hidden from the / menu (user-invocable: false)`
            : typed !== name ? `no Skill or command is named ${typed} (the project Skill is /${name})` : undefined;
        const { order, product, rev } = session.release;
        const proofName = convention ? `${order}-${product}-v${rev}.pdf` : `${order}-${product}-final.pdf`;
        if (problem) {
          push({ actor: "service", kind: "error", label: `${session.command} · not run`, detail: problem, source: sources.skill, tone: "bad" });
          release = { resolved: false, problem, proofName, skipped: input.checklist.map(({ label }) => label), example: null };
        } else {
          const skipped = input.checklist.filter(({ pattern }) => !regex(pattern).test(body)).map(({ label }) => label);
          const example = resolveExample(session.machine);
          push({ actor: "learner-artifact", kind: "request", label: `${session.command} · ${files.skill} loaded`, source: sources.skill });
          for (const { label, pattern } of input.checklist) {
            const done = regex(pattern).test(body);
            push({ actor: "model", kind: done ? "output" : "decision", label: done ? `Release step · ${label}` : `Release step skipped · ${label}`, tone: done ? undefined : "bad",
              source: done ? lineIn("skill", parsed.skill.text, regex(pattern)) : sources.skill });
          }
          if (example) push({ actor: "tool", kind: example.reachable ? "tool_result" : "error", label: `Read(${example.path})`, detail: example.reachable ? "Approved example opened and compared." : "File not found on this machine.",
            tone: example.reachable ? "ok" : "bad", source: lineIn("skill", parsed.skill.text, /approved-example\.md/) });
          push({ actor: "service", kind: "output", label: `Proof saved as ${proofName}`, tone: convention ? "ok" : "bad",
            detail: convention ? "Named by the shop’s convention." : "No instruction in context says how to name proofs." });
          release = { resolved: true, proofName, skipped, example };
        }
      }

      // --- files Claude reads and edits ---
      const touches = session.touches.map((touch) => {
        const paper = [...(paperAtLaunch ? [paperAtLaunch] : []), ...(ruleMatches(touch.path) && paperRe.test(ruleBody) ? [files.rule] : [])];
        const via = ruleMatches(touch.path) ? ` · ${files.rule} loads (paths match)` : "";
        push({ actor: "model", kind: "tool_call", label: `Edit(${touch.path})${via}`, source: via ? sources.rule : undefined,
          detail: paper.length ? `Paper-size rule in context (from ${[...new Set(paper)].join(", ")}).` : "No paper-size rule in context.",
          tone: paper.length ? touch.proof ? "ok" : "bad" : touch.proof ? "bad" : undefined });
        return { ...touch, paper: [...new Set(paper)] };
      });

      // --- does Claude start the release on its own? ---
      const autoRelease = !!session.tempts && skillLoaded && !manualOnly;
      if (session.tempts) {
        push({ actor: "model", kind: autoRelease ? "tool_call" : "response", source: sources.skill,
          label: autoRelease ? `Claude invokes Skill(${name}) on its own` : "Claude answers the question; no release started",
          detail: autoRelease ? "The Skill’s release steps begin without an operator typing the command." : undefined, tone: autoRelease ? "bad" : "ok" });
      }
      return { id: session.id, at: session.at, who: session.who, machine: session.machine, prompt: session.prompt, launch, convention, personal, paperAtLaunch, touches, release, autoRelease };
    });
    return { trace, out: { sessions, sources }, metrics: {
      ruleMisloads: sessions.reduce((total, { touches }) => total + touches.filter(({ proof, paper }) => !proof && paper.length).length, 0),
    } };
  },
};
