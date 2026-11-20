import type { Choices } from "./missions";

export const referenceSources = [
  { id: "faq", name: "Program FAQ · rev 6", detail: "Cancellation requires 24 hours’ notice. Owner: Public Programs." },
  { id: "glossary", name: "Access glossary · Nov", detail: "An ALK is an assistive listening kit. Ask at the service desk to borrow one." },
  { id: "old", name: "Program FAQ · rev 5", detail: "Cancellation requires 48 hours’ notice. The program manager retired this revision." },
  { id: "circulation", name: "Circulation records", detail: "This folder contains personal borrowing records and is outside Public Programs." },
] as const;

type SourceId = typeof referenceSources[number]["id"];
type Shelf = "project" | "chat" | "off";
export const instructionClips = [
  { id: "cite", text: "Cite the current approved policy or glossary behind each claim." },
  { id: "contact", text: "Include the service desk contact in public replies." },
  { id: "refer", text: "Send case-specific exceptions to the service desk for verification." },
  { id: "infer", text: "Fill missing policy details from similar past cases." },
] as const;
type Instruction = typeof instructionClips[number]["id"];

export type ReferenceWork = {
  kind: "library-desk";
  shared: boolean;
  shelves: Record<SourceId, Shelf>;
  scope: "program" | "all";
  instructions: Instruction[];
};
export const referenceBaseline: ReferenceWork = {
  kind: "library-desk", shared: false, shelves: { faq: "chat", glossary: "chat", old: "project", circulation: "off" },
  scope: "all", instructions: [],
};

export function runReference(work: ReferenceWork) {
  const loaded = (id: SourceId) => work.shared && work.shelves[id] === "project";
  const rule = (id: Instruction) => work.shared && work.instructions.includes(id);
  const source = loaded("old") ? "Program FAQ · rev 5" : loaded("faq") ? "Program FAQ · rev 6" : null;
  const deadline = source === null ? null : loaded("old") ? 48 : 24;
  const cite = (name: string) => rule("cite") ? ` [${name}]` : "";
  const contact = rule("contact") ? " Contact the service desk." : "";
  const policy = deadline === null ? "There is no cancellation policy loaded in this chat." : `Cancel at least ${deadline} hours ahead.${cite(source!)}`;
  const access = loaded("glossary") ? `Ask the service desk for an assistive listening kit.${cite("Access glossary · Nov")}`
    : "I don’t have a current definition of ALK.";
  const privateSources = work.scope === "all" || loaded("circulation");
  const exception = rule("infer") ? "Approved based on a similar past visit." :
    rule("refer") ? "I’ve sent the exception to the service desk for verification." : "The exception is still in the chat.";
  return {
    replies: [
      { title: "Can I cancel tomorrow’s workshop?", reply: policy + contact },
      { title: "Where can I borrow an ALK?", reply: access + contact },
      { title: "Can you use a previous visitor’s record to waive the cutoff?", reply: exception + contact },
    ],
    loaded: referenceSources.filter(({ id }) => loaded(id)).map(({ name }) => name),
    privateSources,
    passes: [work.shared, loaded("glossary") && rule("contact"), !privateSources,
      rule("cite") && rule("refer") && !rule("infer"), deadline === 24],
  };
}

const delta = (text: string) => `event: content_block_delta\ndata: ${JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text } })}\n\n`;
const stop = 'event: message_stop\ndata: {"type":"message_stop"}\n\n';
const error = 'event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"Fixture upstream overloaded"}}\n\n';
const first = delta("Proof approved for ");
const second = delta("A3 only.");
export const streamFixtures = [
  { id: "split", name: "Split event, authorized", authorized: true, chunks: [first.slice(0, 78), first.slice(78) + second.slice(0, 35), second.slice(35), stop], expected: "Proof approved for A3 only.", stopped: true },
  { id: "error", name: "Upstream error", authorized: true, chunks: [first, error], expected: "Proof approved for ", stopped: false },
  { id: "visitor", name: "Unauthenticated visitor", authorized: false, chunks: [first, second, stop], expected: "", stopped: false },
] as const;
export const streamFiles = [
  { path: "packages/posters/tests/proof/size.test.ts", expected: true },
  { path: "packages/programs/tests/proof/layout.test.ts", expected: true },
  { path: "packages/programs/src/billing.ts", expected: false },
] as const;

export type StreamWork = {
  kind: "printworks-stream";
  decoder: "chunks" | "frames" | "buffer";
  bridge: "browser" | "service" | "buffer";
  rules: "personal" | "proof" | "root";
};
export const streamBaseline: StreamWork = { kind: "printworks-stream", decoder: "chunks", bridge: "buffer", rules: "personal" };

function decodeFixture(chunks: readonly string[], decoder: StreamWork["decoder"]) {
  let text = "";
  let pending = "";
  let stopped = false;
  let failure = "";
  const emitted: { chunk: number; text: string }[] = [];
  for (const [position, chunk] of chunks.entries()) {
    pending += chunk;
    if (decoder === "buffer" && position < chunks.length - 1) continue;
    const frames = pending.split("\n\n");
    pending = decoder === "chunks" ? "" : frames.pop() ?? "";
    for (const frame of frames) {
      const data = frame.split("\n").find((line) => line.startsWith("data: "));
      if (!data) continue;
      try {
        const event = JSON.parse(data.slice(6));
        if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
          text += event.delta.text;
          emitted.push({ chunk: position + 1, text: event.delta.text });
        } else if (event.type === "message_stop") {
          stopped = true;
        } else if (event.type === "error") {
          failure = event.error.type;
        }
      } catch {
        // A partial event is unusable until its complete frame has arrived.
      }
    }
  }
  return { text, stopped, failure, emitted };
}

export function runStream(work: StreamWork) {
  const rows = streamFixtures.map((fixture) => {
    const blocked = work.bridge === "service" && !fixture.authorized;
    const decoded = decodeFixture(blocked ? [] : fixture.chunks, work.decoder);
    const browserEvents = work.bridge === "buffer"
      ? decoded.stopped ? [{ chunk: fixture.chunks.length, text: decoded.text }] : []
      : decoded.emitted;
    return { ...fixture, ...decoded, blocked, browserEvents };
  });
  const files = streamFiles.map((file) => ({
    ...file,
    loaded: work.rules === "root" || (work.rules === "proof" && /\/tests\/proof\//.test(file.path)),
  }));
  const split = rows[0];
  return { rows, files, passes: [
    split.text === split.expected && split.stopped && rows[1].failure === "overloaded_error" && !rows[1].stopped,
    rows[2].blocked && split.browserEvents.length > 0 && split.browserEvents[0].chunk < split.chunks.length,
    files.every(({ expected, loaded }) => expected === loaded),
  ] };
}

const documents = [
  { id: "M-027", revision: "R1", collection: "Public services", title: "Reading room booking", words: ["booking", "desk"], concepts: ["reserve", "seat"], body: "Book in person. Retired January.", active: false },
  { id: "M-027", revision: "R2", collection: "Public services", title: "Reading room booking", words: ["booking", "desk"], concepts: ["reserve", "seat"], body: "Use the public calendar and confirm with the desk.", active: true },
  { id: "Q-381", revision: "R1", collection: "Map conservation", title: "Oversize map storage", words: ["map", "oversize"], concepts: ["large", "unfold"], body: "Store flat in the controlled cabinet.", active: true },
  { id: "Q-318", revision: "R3", collection: "Map conservation", title: "Oversize map handling", words: ["map", "oversize"], concepts: ["large", "unfold"], body: "Move unfolded maps on a rigid support.", active: true },
  { id: "M-079", revision: "R5", collection: "Public services", title: "Reproduction permission", words: ["copies", "permission"], concepts: ["publish", "rights"], body: "Log permission by accession number.", active: true },
  { id: "G-116", revision: "R3", collection: "Records management", title: "Register transfer", words: ["register", "transfer"], concepts: ["movement", "ledger"], body: "Record the destination and transfer date.", active: true },
] as const;
export const retrievalQueries = [
  { id: "accession", text: "Q-318", match: "Q-318", term: "q-318", kind: "identifier", rerank: false },
  { id: "booking", text: "Reserve a seat", match: "M-027", term: "seat", kind: "description", rerank: false },
  { id: "handling", text: "How do I move a large unfolded sheet?", match: "Q-318", term: "unfold", kind: "description", rerank: true },
  { id: "copy", text: "Publication rights", match: "M-079", term: "rights", kind: "description", rerank: false },
  { id: "transfer", text: "Register transfer", match: "G-116", term: "register", kind: "description", rerank: false },
  { id: "accession-2", text: "G-116", match: "G-116", term: "g-116", kind: "identifier", rerank: false },
] as const;

export type RetrievalWork = {
  kind: "library-retrieval-architecture";
  match: "dense" | "lexical" | "hybrid";
  sections: boolean;
  activeOnly: boolean;
  rerank: "all" | "flagged" | "off";
  trace: "total" | "payloads" | "linked";
};
export const retrievalBaseline: RetrievalWork = {
  kind: "library-retrieval-architecture", match: "dense", sections: false, activeOnly: false, rerank: "off", trace: "total",
};

export function runRetrieval(work: RetrievalWork) {
  const rows = retrievalQueries.map((query) => {
    const candidates = documents.filter((doc) => (!work.activeOnly || doc.active) && (
      (work.match !== "dense" && [doc.id.toLowerCase(), ...doc.words].some((term) => term === query.term)) ||
      (work.match !== "lexical" && doc.concepts.some((term) => term === query.term))
    ));
    const rerank = work.rerank === "all" || (work.rerank === "flagged" && query.rerank);
    if (rerank) {
      const terms = new Set(query.text.toLowerCase().split(/\W+/).filter((term) => term.length > 3));
      const overlap = (body: string) => body.toLowerCase().split(/\W+/).filter((term) => terms.has(term)).length;
      candidates.sort((left, right) => overlap(right.body) - overlap(left.body));
    }
    const selected = candidates[0];
    const indexMs = work.match === "hybrid" ? 61 : 44;
    const rerankMs = rerank ? query.rerank ? 56 : 112 : 0;
    const composeMs = 32;
    const latency = indexMs + rerankMs + composeMs;
    return { ...query, candidates, selected, rerank, indexMs, rerankMs, composeMs, latency,
      correct: !!selected && selected.id === query.match && selected.active };
  });
  const times = rows.map(({ latency }) => latency).sort((a, b) => a - b);
  const p95 = times[Math.ceil(times.length * .95) - 1];
  const hits = rows.filter(({ correct }) => correct).length;
  return {
    rows, p95, hits,
    passes: [p95 <= 160 && rows.find(({ id }) => id === "handling")!.correct, work.sections, hits === rows.length,
      work.trace === "linked", work.activeOnly && rows.find(({ id }) => id === "booking")!.selected?.revision === "R2"],
  };
}

export type Fieldwork = ReferenceWork | StreamWork | RetrievalWork;

export function validFieldwork(work: Fieldwork) {
  switch (work.kind) {
    case "library-desk":
      return typeof work.shared === "boolean" && !!work.shelves && referenceSources.every(({ id }) =>
        ["project", "chat", "off"].includes(work.shelves[id])) && ["program", "all"].includes(work.scope) &&
        Array.isArray(work.instructions) && new Set(work.instructions).size === work.instructions.length &&
        work.instructions.every((id) => instructionClips.some((clip) => clip.id === id));
    case "printworks-stream":
      return ["chunks", "frames", "buffer"].includes(work.decoder) && ["browser", "service", "buffer"].includes(work.bridge) &&
        ["personal", "proof", "root"].includes(work.rules);
    case "library-retrieval-architecture":
      return ["dense", "lexical", "hybrid"].includes(work.match) && typeof work.sections === "boolean" &&
        typeof work.activeOnly === "boolean" && ["all", "flagged", "off"].includes(work.rerank) &&
        ["total", "payloads", "linked"].includes(work.trace);
  }
}

export function fieldworkChoices(work: Fieldwork): Choices {
  switch (work.kind) {
    case "library-desk": {
      const [workspace, policy, scope, behavior, revision] = runReference(work).passes;
      return { "3.1": [workspace ? 1 : 0], "5.1": [policy ? 1 : 0], "5.2": [scope ? 1 : 0],
        "5.3": [behavior ? 1 : 0], "5.4": [revision ? 1 : 0] };
    }
    case "printworks-stream": {
      const [decoder, bridge, rules] = runStream(work).passes;
      return { "4.1": [decoder ? 1 : 0], "5.2": [bridge ? 1 : 0], "3.1": [rules ? 1 : 0] };
    }
    case "library-retrieval-architecture": {
      const [latency, metadata, search, trace, revision] = runRetrieval(work).passes;
      return { "3.3": [latency ? 1 : 0], "3.5": [metadata ? 1 : 0], "3.6": [search ? 1 : 0],
        "3.4": [trace ? 1 : 0], "4.4": [revision ? 1 : 0] };
    }
  }
}
