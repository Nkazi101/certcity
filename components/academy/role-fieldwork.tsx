import { Activity, Archive, ArrowRight, BookOpen, Check, FileText, Play, Search, Terminal } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import {
  instructionClips, referenceBaseline, referenceSources, retrievalBaseline, retrievalQueries, runReference, runRetrieval,
  runStream, streamBaseline, streamFixtures,
} from "../../lib/claude/fieldwork";
import type { Fieldwork, ReferenceWork, RetrievalWork, StreamWork } from "../../lib/claude/fieldwork";

type Props<T> = { value: T; change: (value: T) => void; save: (value: T) => void; busy: boolean; saved: boolean };

function Select<T extends string>({ label, value, change, options }: {
  label: string; value: T; change: (value: T) => void; options: readonly (readonly [T, string])[];
}) {
  return <label className="fieldwork-select"><span>{label}</span>
    <select value={value} onChange={(event) => change(event.target.value as T)}>
      {options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
    </select>
  </label>;
}

function CheckField({ children, checked, change }: { children: ReactNode; checked: boolean; change: (checked: boolean) => void }) {
  return <label className="fieldwork-check"><input type="checkbox" checked={checked} onChange={(event) => change(event.target.checked)} />{children}</label>;
}

function Results({ names, passes, reveal, saved, busy, run, save, action }: {
  names: string[]; passes: boolean[]; reveal: boolean; saved: boolean; busy: boolean; run: () => void; save: () => void; action: string;
}) {
  return <footer className="fieldwork-actions">
    <button className="button button-primary" onClick={run}><Play size={15} aria-hidden="true" />{action}</button>
    {reveal && <ul aria-label="Acceptance results" aria-live="polite">{names.map((name, index) => <li key={name} data-pass={passes[index]}>
      <strong>{passes[index] ? "Met" : "Review"}</strong> {name}
    </li>)}</ul>}
    {reveal && passes.every(Boolean) && !saved && <button className="button button-outline" type="button" disabled={busy} onClick={save}>
      <Check size={16} aria-hidden="true" />Save outcome
    </button>}
    {saved && <p role="status">Outcome saved to City impact</p>}
  </footer>;
}

function ReferenceProject({ value, change, save, busy, saved }: Props<ReferenceWork>) {
  const [run, setRun] = useState<ReferenceWork | null>(null);
  const [source, setSource] = useState<(typeof referenceSources)[number]["id"]>("faq");
  const evidence = referenceSources.find(({ id }) => id === source)!;
  const result = runReference(value);
  const reveal = run === value || saved;
  return <section className="role-fieldwork reference-fieldwork" aria-labelledby="reference-project-heading">
    <header><BookOpen aria-hidden="true" /><div><h3 id="reference-project-heading">Reference Project</h3>
      <p>Build a shared workspace and open a new librarian chat to check what it inherits.</p></div></header>
    <div className="fieldwork-columns">
      <section className="fieldwork-panel">
        <h4>Policy shelf</h4>
        <nav aria-label="Inspect policy files" className="fieldwork-tabs">
          {referenceSources.map(({ id, name }) => <button type="button" key={id} aria-pressed={id === source} onClick={() => setSource(id)}>{name}</button>)}
        </nav>
        <article className="fieldwork-paper">
          <FileText size={18} aria-hidden="true" /><strong>{evidence.name}</strong><p>{evidence.detail}</p>
          <Select label="File placement" value={value.shelves[source]} options={[
            ["project", "Project knowledge"], ["chat", "Only this chat"], ["off", "Outside the workspace"],
          ]} change={(shelf) => change({ ...value, shelves: { ...value.shelves, [source]: shelf } })} />
        </article>
        <CheckField checked={value.shared} change={(shared) => change({ ...value, shared })}>Use a shared Project for separate chats</CheckField>
        <Select label="Connector read access" value={value.scope} options={[
          ["all", "Entire library account"], ["program", "Approved Public Programs only"],
        ]} change={(scope) => change({ ...value, scope })} />
      </section>
      <section className="fieldwork-panel">
        <h4>Project instructions</h4>
        <p>Build the instructions all four librarians should share.</p>
        {instructionClips.map(({ id, text }) => <CheckField key={id} checked={value.instructions.includes(id)} change={(checked) => change({
          ...value, instructions: checked ? [...value.instructions, id] : value.instructions.filter((entry) => entry !== id),
        })}>{text}</CheckField>)}
        {reveal && <div className="fieldwork-thread" aria-live="polite">
          <h4>New librarian chat</h4>
          <p>Loaded references · {result.loaded.join(", ") || "None"}</p>
          <p>Circulation access · {result.privateSources ? "Available to this workspace" : "Excluded"}</p>
          {result.replies.map(({ title, reply }) => <article key={title}><h5>{title}</h5><p>{reply}</p></article>)}
        </div>}
      </section>
    </div>
    <Results {...{ reveal, busy, saved }} names={["Four separate chats share the Project", "Glossary and contact survive a fresh chat",
      "Restricted circulation stays outside", "Claims cite evidence and exceptions reach staff", "Current cancellation policy used"]}
      passes={result.passes} run={() => setRun(value)} save={() => save(value)} action="Open a fresh test chat" />
  </section>;
}

function ProofStream({ value, change, save, busy, saved }: Props<StreamWork>) {
  const [fixture, setFixture] = useState<(typeof streamFixtures)[number]["id"]>("split");
  const [position, setPosition] = useState(0);
  const [run, setRun] = useState<StreamWork | null>(null);
  const result = runStream(value);
  const row = result.rows.find(({ id }) => id === fixture)!;
  const reveal = run === value || saved;
  return <section className="role-fieldwork stream-fieldwork" aria-labelledby="stream-heading">
    <header><Terminal aria-hidden="true" /><div><h3 id="stream-heading">Proof console event inspector</h3>
      <p>Inspect the captured provider chunks. Keep the browser stream useful when a chunk splits or the provider stops mid-proof.</p></div></header>
    <div className="fieldwork-columns">
      <section className="fieldwork-panel fieldwork-technical">
        <h4>Provider capture</h4>
        <nav className="fieldwork-tabs" aria-label="Captured streams">{streamFixtures.map(({ id, name }) => <button type="button" key={id}
          aria-pressed={fixture === id} onClick={() => { setFixture(id); setPosition(0); }}>{name}</button>)}</nav>
        <div className="fieldwork-chunk-head"><strong>Chunk {position + 1} of {row.chunks.length}</strong>
          <div><button className="button button-outline" type="button" disabled={!position} onClick={() => setPosition(position - 1)}>Back</button>
            <button className="button button-outline" type="button" disabled={position === row.chunks.length - 1} onClick={() => setPosition(position + 1)}>Next chunk</button></div>
        </div>
        <pre tabIndex={0} aria-label="Raw server-sent event chunk"><code>{row.chunks[position]}</code></pre>
        {reveal && <div className="fieldwork-output" aria-live="polite">
          <strong>Authorized browser output through chunk {position + 1}</strong>
          <p>{row.blocked ? "Visitor received an authorization error before any event was forwarded." :
            row.browserEvents.filter(({ chunk }) => chunk <= position + 1).map(({ text }) => text).join("") || "No text emitted yet."}</p>
          <span>{position === row.chunks.length - 1 && !row.blocked ? row.failure ? `Stream error · ${row.failure}. Proof stays provisional.` :
            row.stopped ? "message_stop received. Proof text is complete." : "Stream ended without a completion event." : ""}</span>
        </div>}
      </section>
      <section className="fieldwork-panel">
        <h4>Application changes</h4>
        <Select label="Decoder strategy" value={value.decoder} options={[
          ["chunks", "Parse each arriving chunk immediately"], ["frames", "Buffer until the next complete event frame"],
          ["buffer", "Collect the entire response before parsing"],
        ]} change={(decoder) => change({ ...value, decoder })} />
        <Select label="Browser bridge" value={value.bridge} options={[
          ["browser", "Forward events to every browser connection"], ["service", "Validate session and translate server-side events"],
          ["buffer", "Send the complete provider result after the stream ends"],
        ]} change={(bridge) => change({ ...value, bridge })} />
        <Select label="Shared instructions in a fresh checkout" value={value.rules} options={[
          ["personal", "Operator’s personal settings"], ["proof", "Project rule scoped to the two proof-test paths"], ["root", "Root project instructions"],
        ]} change={(rules) => change({ ...value, rules })} />
        {reveal && <ul aria-label="Path rule replay" className="fieldwork-file-results">{result.files.map(({ path, loaded }) =>
          <li key={path}><code>{path}</code><strong>{loaded ? "Loaded" : "Absent"}</strong></li>)}</ul>}
      </section>
    </div>
    <Results {...{ reveal, busy, saved }} names={["Split frames and terminal errors recovered correctly",
      "Authorized live dispatch with a server-held provider connection", "Proof rule loads for both packages and stays out of billing"]}
      passes={result.passes} run={() => setRun(value)} save={() => save(value)} action="Run proof console fixtures" />
  </section>;
}

function RetrievalBench({ value, change, save, busy, saved }: Props<RetrievalWork>) {
  const [run, setRun] = useState<RetrievalWork | null>(null);
  const [query, setQuery] = useState<(typeof retrievalQueries)[number]["id"]>("accession");
  const after = runRetrieval(value);
  const before = runRetrieval(retrievalBaseline);
  const row = after.rows.find(({ id }) => id === query)!;
  const reveal = run === value || saved;
  return <section className="role-fieldwork retrieval-fieldwork" aria-labelledby="retrieval-heading">
    <header><Search aria-hidden="true" /><div><h3 id="retrieval-heading">Archive search bench</h3>
      <p>Protect exact IDs and paraphrases, keep revision evidence with each passage, and hold fixture p95 to 160 ms.</p></div></header>
    <div className="fieldwork-columns">
      <section className="fieldwork-panel">
        <h4>Search pipeline</h4>
        <Select label="Candidate retrieval" value={value.match} options={[
          ["dense", "Semantic only"], ["lexical", "Lexical only"], ["hybrid", "Merge lexical and semantic candidates"],
        ]} change={(match) => change({ ...value, match })} />
        <CheckField checked={value.sections} change={(sections) => change({ ...value, sections })}>Keep revision and collection with each indexed section</CheckField>
        <CheckField checked={value.activeOnly} change={(activeOnly) => change({ ...value, activeOnly })}>Search current revisions only</CheckField>
        <Select label="Reranking" value={value.rerank} options={[
          ["off", "Skip reranking"], ["all", "Rerank all candidates"], ["flagged", "Rerank flagged ambiguous queries"],
        ]} change={(rerank) => change({ ...value, rerank })} />
        <Select label="Diagnostics" value={value.trace} options={[
          ["total", "Overall client latency"], ["payloads", "Log complete input and retrieved payloads"],
          ["linked", "Join stage timing and status by request ID"],
        ]} change={(trace) => change({ ...value, trace })} />
      </section>
      <section className="fieldwork-panel fieldwork-archive">
        <h4>Review labeled queries</h4>
        <nav aria-label="Retrieval queries" className="fieldwork-tabs">
          {retrievalQueries.map(({ id, text }) => <button type="button" key={id} aria-pressed={query === id} onClick={() => setQuery(id)}>{text}</button>)}
        </nav>
        <div className="fieldwork-query"><Archive size={17} aria-hidden="true" /><span>{row.kind === "identifier" ? "Accession query" : "Description query"}</span>
          <strong>{row.text}</strong><small>Labeled expected record · {row.match}</small></div>
        {reveal && <div className="fieldwork-output" aria-live="polite">
          <dl className="fieldwork-metrics"><div><dt>Current matches</dt><dd>{before.hits} → {after.hits}/{after.rows.length}</dd></div>
            <div><dt>Fixture p95</dt><dd>{before.p95} → {after.p95} ms</dd></div></dl>
          <ul className="fieldwork-file-results">{row.candidates.map((candidate) => <li key={candidate.id + candidate.revision}>
            <span>{candidate.title}{value.sections && <> · {candidate.collection} · {candidate.id} {candidate.revision}</>}</span>
            <strong>{candidate === row.selected ? "Selected" : "Candidate"}</strong>
          </li>)}</ul>
          <p>{row.selected?.body ?? "No candidate returned."}</p>
          {row.rerank && <p>The fixture reranks candidates by overlap between the query and passage text.</p>}
          {value.trace === "linked" ? <p className="fieldwork-trace"><Activity size={16} aria-hidden="true" />
            {row.id} · Index {row.indexMs} ms <ArrowRight size={12} /> Rerank {row.rerankMs} ms <ArrowRight size={12} /> Compose {row.composeMs} ms</p>
            : <p>Total {row.latency} ms · {value.trace === "payloads" ? "Full payloads would enter the logs." : "Stages are not correlated."}</p>}
        </div>}
      </section>
    </div>
    <Results {...{ reveal, busy, saved }} names={["Ambiguity handled inside p95 limit", "Retrieved passages retain source context",
      "Both query slices match their current records", "Stage traces link without raw request text", "Booking lookup returns the current revision"]}
      passes={after.passes} run={() => setRun(value)} save={() => save(value)} action="Run the labeled query set" />
  </section>;
}

export function RoleFieldwork({ id, value, ...actions }: {
  id: Fieldwork["kind"]; value?: Fieldwork; change: (work: Fieldwork) => void; save: (work: Fieldwork) => void; busy: boolean; saved: boolean;
}) {
  switch (id) {
    case "library-desk": return <ReferenceProject value={value?.kind === id ? value : referenceBaseline} {...actions} />;
    case "printworks-stream": return <ProofStream value={value?.kind === id ? value : streamBaseline} {...actions} />;
    case "library-retrieval-architecture": return <RetrievalBench value={value?.kind === id ? value : retrievalBaseline} {...actions} />;
  }
}
