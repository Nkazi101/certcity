import {
  Activity, Archive, ArrowRight, BadgeCheck, Boxes, Braces,
  Check, ChevronRight, CircleAlert, ClipboardCheck, ClipboardList, Clock3, Code2, Database, FileCheck2, FileClock, FileSearch, FileText, GitBranch, GitPullRequest, Hand, Inbox,
  LockKeyhole, MessageSquareText, PackageCheck, Play, Plus, RefreshCw, Search,
  ShieldCheck, SlidersHorizontal, Table2, Terminal, Timer, Truck, Users,
  Workflow, Wrench, X,
} from "lucide-react";
import type { ReactNode } from "react";
import type { Choices, Mission } from "../../lib/claude/missions";
import { replayMission } from "../../lib/claude/missions";
import type { Workload } from "../../lib/claude/workload";
import { missionExperiences } from "../../lib/claude/mission-experiences";
import { RoleMissionBoard } from "./role-mission-board";
import { MissionMechanic } from "./role-mission-mechanic";

type Workbench = Extract<Mission, { kind: "workbench" }>;
type Replay = ReturnType<typeof replayMission>;

type MissionLabProps = {
  mission: Workbench;
  position: number;
  choices: Choices;
  run: Choices | null;
  saved: boolean;
  meetsGoals: boolean;
  replay: Replay;
  workload: Workload | null;
  baseWorkload: Workload | null;
  busy: boolean;
  error: boolean;
  onChoose: (indices: number[]) => void;
  onPosition: (index: number) => void;
  onRun: () => void;
  onAdjust: () => void;
  onSave: () => void;
  onBackToEvidence: () => void;
};

function Pill({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "good" | "warn" | "bad" }) {
  return <span className={`mission-pill mission-pill--${tone}`}>{children}</span>;
}

function Artifact({ icon: Icon, eyebrow, title, children, state }: {
  icon: typeof FileText;
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  state?: ReactNode;
}) {
  return <article className="mission-artifact">
    <header><Icon size={18} aria-hidden="true" /><div>{eyebrow && <small>{eyebrow}</small>}<strong>{title}</strong></div>{state}</header>
    {children && <div className="mission-artifact-body">{children}</div>}
  </article>;
}

function Setting({ title, description, selected, onClick, icon: Icon }: {
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  icon: typeof FileText;
}) {
  return <button type="button" className="mission-setting" aria-pressed={selected} data-selected={selected || undefined} onClick={onClick}>
    <span className="mission-setting-icon"><Icon size={17} aria-hidden="true" /></span>
    <span><strong>{title}</strong><small>{description}</small></span>
    <span className="mission-setting-check" aria-hidden="true">{selected ? <Check size={15} /> : null}</span>
  </button>;
}

function StationEvidence({ decision }: { decision: Workbench["decisions"][number] }) {
  return <div className="mission-station-brief">
    <span>Evidence in this case</span>
    <p>{decision.evidence}</p>
  </div>;
}

function SectionHeading({ icon: Icon, eyebrow, title, detail }: {
  icon: typeof FileText;
  eyebrow: string;
  title: string;
  detail?: string;
}) {
  return <div className="mission-section-heading"><span className="mission-section-icon"><Icon size={18} aria-hidden="true" /></span>
    <div><small>{eyebrow}</small><h4>{title}</h4>{detail && <p>{detail}</p>}</div>
  </div>;
}

function LibraryDesk({ mission, position, selected, select }: LabViewProps) {
  const decision = mission.decisions[position];
  const transition = selected[0];
  if (position === 0) return <div className="mission-library-board">
    <div className="mission-trace-column">
      <SectionHeading icon={Workflow} eyebrow="Agent trace · photo source request" title="Catalog lookup" detail="The assistant has not finished its turn." />
      <div className="mission-trace-node"><span>01</span><div><b>Assistant message</b><code>“I’ll check the catalog.”</code></div><Pill>text</Pill></div>
      <div className={`mission-trace-node ${transition === 1 ? "is-complete" : "is-active"}`}><span>02</span><div><b>Stop reason</b><code>tool_use · c42</code></div><Pill tone={transition === 1 ? "good" : "warn"}>{transition === 1 ? "run" : "waiting"}</Pill></div>
      <div className={`mission-trace-node ${transition === 1 ? "is-complete" : "is-muted"}`}><span>03</span><div><b>Linked result</b><code>{transition === 1 ? "appended under c42" : "not in conversation yet"}</code></div><Pill tone={transition === 1 ? "good" : "plain"}>{transition === 1 ? "returned" : "pending"}</Pill></div>
      <div className="mission-trace-controls">
        <button type="button" className="mission-utility-button" aria-pressed={transition === 0} onClick={() => select([0])}><X size={15} />End on the text</button>
        <button type="button" className="mission-utility-button" aria-pressed={transition === 2} onClick={() => select([2])}><ArrowRight size={15} />Return raw rows</button>
      </div>
      <Setting title="Run c42, append its linked result, continue" description="Keep the tool request and result together in the next turn." icon={Play} selected={selected.includes(1)} onClick={() => select([1])} />
    </div>
    <Artifact icon={Database} eyebrow="Pending archive tool call" title="Call c42" state={<Pill tone="warn">not run</Pill>}>
      <dl className="mission-payload"><div><dt>Tool call ID</dt><dd>c42</dd></div><div><dt>Request</dt><dd>Find the source of this photo</dd></div><div><dt>Available evidence</dt><dd>A matching accession record</dd></div></dl>
      <p className="mission-preview-note">Choose the transition the runner should take. The result becomes part of the trace only after the tool call is run and returned.</p>
    </Artifact>
  </div>;
  if (position === 1) return <div className="mission-connector-board">
    <SectionHeading icon={Search} eyebrow="Connector catalog · 2 definitions" title="Separate lookup from creation" detail="A visitor asks for the source of an existing photograph." />
    <div className="mission-connector-cards">
      <Artifact icon={FileSearch} eyebrow="search_records" title="Find exhibit material" state={<Pill tone="warn">overlaps</Pill>}><p>Searches archive records and returns existing evidence.</p><code>read: records</code></Artifact>
      <Artifact icon={Plus} eyebrow="search_exhibit" title="Find exhibit material" state={<Pill tone="bad">creates draft</Pill>}><p>Creates a draft exhibit record as a side effect.</p><code>write: exhibit draft</code></Artifact>
    </div>
    <div className="mission-route-strip"><span>Visitor request</span><strong>“Find the source of this photo.”</strong><ChevronRight size={18} /><span>Choose the contract to improve</span></div>
    <MissionMechanic mission={mission} position={position} selected={selected} select={select} />
  </div>;
  return <div className="mission-provenance-board">
    <SectionHeading icon={Archive} eyebrow="Exhibit label · source review" title="Keep unlike counts auditable" detail="Two records describe different periods and measurement methods." />
    <div className="mission-claim-sources">
      <Artifact icon={Table2} eyebrow="Saturday · direct measure" title="83 ticket scans"><p>Method: ticket scans</p><Pill>Saturday only</Pill></Artifact>
      <Artifact icon={FileText} eyebrow="Weekend · estimate" title="120 attendees"><p>Method: estimated attendance</p><Pill>Full weekend</Pill></Artifact>
    </div>
    <div className="mission-report-preview"><span>Exhibit note preview</span><div className="mission-report-lines">
      {selected[0] === 1 ? <><p><b>Saturday ticket scans</b> · 83 · source retained</p><p><b>Weekend attendance estimate</b> · 120 · method retained</p></> : selected[0] === 0 ? <p><b>Average attendance</b> · 102 · two incomparable measures combined</p> : selected[0] === 2 ? <p><b>Attendance</b> · newest source value · prior claim retained without its method</p> : <p>Select how to compose this evidence into the label.</p>}
    </div></div>
    <MissionMechanic mission={mission} position={position} selected={selected} select={select} />
  </div>;
}

function BookingFlow({ mission, position, selected, select }: LabViewProps) {
  const decision = mission.decisions[position];
  return <div className="mission-booking-board">
    <div className="mission-booking-flow">
      <SectionHeading icon={Workflow} eyebrow="Room change request" title="Protect the booking write" />
      <div className="mission-booking-nodes"><span>Resident request</span><ChevronRight /><span>Identity & eligibility</span><ChevronRight /><b>Room update</b></div>
      <Artifact icon={LockKeyhole} eyebrow="Service evidence" title="Verification record"><p>Current session: “verified”</p><p>Matching record for this resident and room: <strong>not found</strong></p><Pill tone="bad">write is sensitive</Pill></Artifact>
      <Artifact icon={Activity} eyebrow="Read response" title="Eligibility timestamp"><p>The tool returns an epoch timestamp.</p><p>Normalize successful output before the assistant uses it.</p></Artifact>
    </div>
    <div className="mission-booking-controls"><SectionHeading icon={position === 0 ? ShieldCheck : position === 1 ? SlidersHorizontal : Users}
      eyebrow={position === 0 ? "Write gate" : position === 1 ? "Hook placement" : "Open tickets"}
      title={position === 0 ? "Set the verification prerequisite" : position === 1 ? "Place the two hooks" : "Choose a safe next action"} />
      {position === 2 && <div className="mission-ticket-pair"><Artifact icon={MessageSquareText} title="Ticket 31"><p>Resident explicitly asks for staff.</p></Artifact><Artifact icon={CircleAlert} title="Ticket 32"><p>Two rooms share the same nickname; no room number.</p></Artifact></div>}
      {position === 0 && <div className="mission-config-preview"><span>Booking service preview</span><strong>{selected[0] === 1 ? "No matching verification record: block the write and send a structured case to staff." : selected[0] === 0 ? "Saved conversation says verified: the service may write without evidence." : selected[0] === 2 ? "The write runs first; staff receive an alert after the room changes." : "The current session claim is not a service verification record."}</strong></div>}
      {position === 1 && <div className="mission-hook-editor">
        <label className="mission-config-select"><span>Unsafe room write gate</span><select value={selected.find((value) => value <= 2) ?? ""} onChange={(event) => {
          const next = selected.filter((value) => value > 2);
          if (event.target.value !== "") next.push(Number(event.target.value));
          select(next);
        }}><option value="">Place the gate</option><option value={2}>At session start</option><option value={1}>PreToolUse · before execution</option><option value={0}>After the tool returns</option></select></label>
        <ArrowRight aria-hidden="true" />
        <label className="mission-config-select"><span>Read timestamp adapter</span><select value={selected.find((value) => value >= 3) ?? ""} onChange={(event) => {
          const next = selected.filter((value) => value < 3);
          if (event.target.value !== "") next.push(Number(event.target.value));
          select(next);
        }}><option value="">Place the adapter</option><option value={4}>No normalization</option><option value={3}>PostToolUse · after successful read</option></select></label>
      </div>}
      {position === 2 && <div className="mission-config-preview"><span>Ticket routing preview</span><strong>{selected[0] === 1 ? "Ticket 31 goes to staff with attempted steps; ticket 32 asks for a room number before booking." : selected[0] === 0 ? "Both tickets remain automated; a requested handoff and an ambiguous room are unresolved." : selected[0] === 2 ? "Both tickets reach staff without the case summary or a clarification request." : "Select an action for each ticket."}</strong></div>}
      {position === 0 || position === 2 ? <MissionMechanic mission={mission} position={position} selected={selected} select={select} /> : <div className="mission-hook-status" aria-live="polite"><span>{selected.includes(1) ? "Write blocked before execution" : "Write gate not configured"}</span><span>{selected.includes(3) ? "Read result normalized" : "Read adapter not configured"}</span></div>}
    </div>
  </div>;
}

function MigrationBench({ mission, position, selected, select }: LabViewProps) {
  const decision = mission.decisions[position];
  const status = ["known local change", "unknown callers", "shared normalizer", "two repair trials", "session may compact"];
  return <div className="mission-migration-board">
    <div className="mission-dependency-rail"><SectionHeading icon={GitBranch} eyebrow="Order system · branch review" title="Migration investigation" />
      <div className="mission-file-row"><FileCodeIcon /><span>Display label</span><Pill tone="good">known local change</Pill></div>
      <div className="mission-file-row is-current"><FileCodeIcon /><span>Shared identifier normalizer</span><Pill tone="warn">failing fixtures</Pill></div>
      <div className="mission-file-row"><FileCodeIcon /><span>Reconciliation module</span><Pill tone="warn">caller unknown</Pill></div>
      <div className="mission-session-cards"><Artifact icon={GitBranch} eyebrow="Verified baseline" title="Prior session"><p>Its commit matches the current branch.</p></Artifact><Artifact icon={FileClock} eyebrow="Durable notes" title="Investigation scratchpad"><p>Verified paths · rejected theory · pending checks</p></Artifact></div>
    </div>
    <div className="mission-migration-controls"><SectionHeading icon={position === 0 ? Workflow : position === 1 ? GitBranch : position === 2 ? Search : position === 3 ? ClipboardCheck : FileClock}
      eyebrow={status[position]} title={decision.station} />
      <MissionMechanic mission={mission} position={position} selected={selected} select={select} />
    </div>
  </div>;
}

function RepairConnector({ selected, select }: { selected: number[]; select: (indices: number[]) => void }) {
  const shared = selected.find((index) => index < 3);
  const experiment = selected.find((index) => index === 3 || index === 4);
  return <div className="repair-connector-files">
    <label className="mission-config-select"><span>Shared issue server</span>
      <select value={shared ?? ""} onChange={(event) => select([
        ...(event.target.value === "" ? [] : [Number(event.target.value)]),
        ...(experiment === undefined ? [] : [experiment]),
      ])}>
        <option value="">Choose where it lives</option>
        <option value={2}>This workstation only</option>
        <option value={1}>Project .mcp.json · environment references</option>
        <option value={0}>Project .mcp.json · embedded token</option>
      </select>
    </label>
    <label className="mission-config-select"><span>Experimental server</span>
      <select value={experiment ?? ""} onChange={(event) => select([
        ...(shared === undefined ? [] : [shared]),
        ...(event.target.value === "" ? [] : [Number(event.target.value)]),
      ])}>
        <option value="">Choose where it lives</option>
        <option value={4}>Track with the project</option>
        <option value={3}>Keep in project-local settings</option>
      </select>
    </label>
    <p aria-live="polite">{shared === undefined ? "Set the shared server’s location to preview a clean checkout."
      : shared === 2 ? "The shared server is missing from the checkout."
        : shared === 0 ? "The shared server loads, but a credential is in version control."
          : "The shared server loads from project configuration. The token comes from the environment."}
      {" "}{experiment === 3 ? "The experiment stays on this machine." : experiment === 4 ? "The experiment would be distributed to the team." : ""}</p>
  </div>;
}

function RepairTools({ mission, position, selected, select }: LabViewProps) {
  const decision = mission.decisions[position];
  return <div className="mission-repair-board">
    <div className="mission-role-matrix"><SectionHeading icon={LockKeyhole} eyebrow="Service counter · access matrix" title="Capabilities by role" />
      <table><thead><tr><th>Capability</th><th>Triage</th><th>Supervisor</th></tr></thead><tbody><tr><th>Read repair status</th><td><Check /></td><td><Check /></td></tr><tr><th>Change repair record</th><td>{selected[0] === 1 ? <X /> : <Check />}</td><td><Check /></td></tr></tbody></table>
      <Pill tone={selected[0] === 1 ? "good" : "warn"}>{selected[0] === 1 ? "status-only tool selected" : selected[0] === 2 ? "queue export selected" : "write capability remains exposed"}</Pill>
      <Artifact icon={Wrench} eyebrow="Caller scope" title="Verified job only"><p>One customer’s repair status · no queue export</p></Artifact>
    </div>
    <div className="mission-repair-controls"><SectionHeading icon={position === 0 ? ShieldCheck : position === 1 ? Braces : Search}
      eyebrow={position === 0 ? "Tool capability" : position === 1 ? "Connector settings" : "Code navigation"}
      title={position === 0 ? "Limit what triage can call" : position === 1 ? "Share the connector safely" : "Find and edit one call site"} />
      {position === 2 && <div className="mission-tool-chain"><span><Search />Grep call sites</span><ChevronRight /><span><FileText />Read target</span><ChevronRight /><span><Code2 />Edit one match</span></div>}
      {position === 1 ? <RepairConnector selected={selected} select={select} /> : <MissionMechanic mission={mission} position={position} selected={selected} select={select} />}
    </div>
  </div>;
}

function PrintworksGate({ mission, position, selected, select }: LabViewProps) {
  const decision = mission.decisions[position];
  return <div className="mission-ci-board">
    <div className="mission-pipeline"><SectionHeading icon={GitPullRequest} eyebrow="Printworks proof release · retried commit" title="Review pipeline" />
      <div className="mission-pipeline-stage"><span>1</span><div><b>Checkout commit</b><small>same commit · retry-safe publication</small></div><Pill tone="good">ready</Pill></div>
      <div className="mission-pipeline-stage"><span>2</span><div><b>Run independent review</b><small>no terminal available</small></div><Pill tone="warn">waiting</Pill></div>
      <div className="mission-pipeline-stage"><span>3</span><div><b>Validate findings</b><small>typed output required</small></div><Pill>queued</Pill></div>
      <div className="mission-finding-pair"><Artifact icon={CircleAlert} title="1 mm offset"><p>Within ±2 mm tolerance</p><Pill tone={selected[0] === 1 ? "good" : "warn"}>{selected[0] === 1 ? "suppress with tolerance evidence" : "reported or misclassified"}</Pill></Artifact><Artifact icon={CircleAlert} title="3 mm mismatch"><p>Renderer and order schema disagree</p><Pill tone={selected[0] === 1 ? "bad" : "warn"}>{selected[0] === 1 ? "report with evidence" : "may be missed"}</Pill></Artifact></div>
    </div>
    <div className="mission-ci-controls"><SectionHeading icon={position === 0 ? Terminal : position === 1 ? SlidersHorizontal : GitPullRequest}
      eyebrow={position === 0 ? "Runner config" : position === 1 ? "Criteria" : "Review passes"}
      title={position === 0 ? "Make the runner parseable and safe to retry" : position === 1 ? "Set the reporting boundary" : "Check the integration independently"} />
      <MissionMechanic mission={mission} position={position} selected={selected} select={select} />
    </div>
  </div>;
}

function MarketCloseBench({ mission, position, selected, select }: LabViewProps) {
  const decision = mission.decisions[position];
  return <div className="mission-market-board">
    <div className="mission-vendor-lines"><SectionHeading icon={Truck} eyebrow="Market hall · closing" title="Vendor operations board" />
      <div className="mission-live-counter"><span><Timer />Live counter</span><b>1 confirmation · due in 6 seconds</b><Pill tone="warn">interactive</Pill></div>
      <div className="mission-batch-counter"><span><Boxes />Archive import</span><b>800 independent summaries · overnight</b><Pill>batch</Pill><small>Three temporary failures · returned order differs from input</small></div>
      <Artifact icon={FileCheck2} eyebrow="Source-linked orders" title="Order-date index"><p>Three purchase orders have different dates. Keep each date attached to its order ID and source ID.</p><div className="mission-index-rows"><span>Order ID <ArrowRight size={13} /> confirmed date <ArrowRight size={13} /> source ID</span><span>Order ID <ArrowRight size={13} /> confirmed date <ArrowRight size={13} /> source ID</span><span>Order ID <ArrowRight size={13} /> confirmed date <ArrowRight size={13} /> source ID</span></div></Artifact>
    </div>
    <div className="mission-market-controls"><SectionHeading icon={position === 0 ? Activity : position === 1 ? Database : position === 2 ? Users : PackageCheck}
      eyebrow={position === 0 ? "Request lanes" : position === 1 ? "Case memory" : "Review capacity"}
      title={decision.station} />
      {position === 0 && <div className="mission-config-preview"><span>Request routing preview</span><strong>{selected[0] === 1 ? "Live confirmation stays interactive; batch rows join by custom_id and only temporary failures retry." : selected[0] === 0 ? "The six-second confirmation waits behind overnight work." : selected[0] === 2 ? "Completed batch rows repeat and may attach to the wrong vendor." : "Choose the live and batch paths for this closing shift."}</strong></div>}
      {position === 1 && <div className="mission-config-preview"><span>Compaction preview</span><strong>{selected[0] === 1 ? "Each active order retrieves its own date and source ID." : selected[0] === 0 ? "The latest narrative date can be copied to unrelated orders." : selected[0] === 2 ? "The full conversation remains in context, but similar vendors can still inherit the wrong date." : "Choose how source-linked order facts are restored."}</strong></div>}
      {position === 2 && <div className="mission-audit-capacity"><div><span>Typed totals</span><strong>99% accurate</strong></div><div><span>Handwritten totals</span><strong>80% accurate</strong></div><div className="mission-audit-slots"><b>10 staff audit slots</b><span>{Array.from({ length: 10 }, (_, i) => <i key={i} />)}</span></div><small>High-confidence handwriting still contains errors.</small></div>}
      {position === 2 && <div className="mission-config-preview"><span>Review allocation preview</span><strong>{selected[0] === 1 ? "Route the weak handwriting segment to review; use the ten audit slots to sample accepted records by form type." : selected[0] === 0 ? "Changing the threshold alone leaves known high-confidence handwriting errors unmeasured." : selected[0] === 2 ? "Reviewing only the lowest-confidence rows misses errors concentrated above the threshold." : "Choose a policy that uses the limited review capacity and checks for silent errors."}</strong></div>}
      <MissionMechanic mission={mission} position={position} selected={selected} select={select} />
    </div>
  </div>;
}

function PeakDispatch({ mission, position, selected, select }: LabViewProps) {
  const decision = mission.decisions[position];
  return <div className="mission-peak-board">
    <div className="mission-queue-monitor"><SectionHeading icon={Truck} eyebrow="City Dispatch · Monday peak" title="Live support queue" />
      <div className="mission-queue-total"><strong>120</strong><span>requests this peak shift</span><Pill tone="warn">supplier outage</Pill></div>
      <div className="mission-queue-stat"><span>Temporary timeouts</span><b>48</b><small>32 have retry time remaining · 24 recover on retry</small></div>
      <div className="mission-queue-stat"><span>Explicit staff requests</span><b>12</b><small>Honor the requested handoff</small></div>
      <div className="mission-queue-stat"><span>Ambiguous order matches</span><b>18</b><small>Ask for one distinguishing detail</small></div>
      <div className="mission-budget-strip"><span><Clock3 />2 h staff cap</span><span><Database />$3.20 lookup budget</span></div>
    </div>
    <div className="mission-peak-controls"><SectionHeading icon={position === 0 ? RefreshCw : position === 1 ? Inbox : Hand}
      eyebrow={position === 0 ? "Retry policy" : position === 1 ? "Coverage and handoff" : "Escalation desk"}
      title={decision.station} />
      <div className="mission-capacity-preview"><span>{[48, 24, 30][position] ?? 0} cases in this station</span><Pill tone="warn">bounded shift</Pill></div>
      <MissionMechanic mission={mission} position={position} selected={selected} select={select} />
    </div>
  </div>;
}

function MarketRush({ mission, position, selected, select }: LabViewProps) {
  const decision = mission.decisions[position];
  return <div className="mission-rush-board">
    <div className="mission-rush-order"><SectionHeading icon={Truck} eyebrow="Market hall · 60-minute closing window" title="Vendor rush planner" />
      <div className="mission-rush-clock"><Clock3 /><strong>60 min</strong><span>available for review</span><Pill tone="warn">$1.60 processing budget</Pill></div>
      <div className="mission-rush-lanes"><Artifact icon={Activity} eyebrow="Needs an answer now" title="16 counter confirmations"><p>Live request · 5¢ each</p><Pill tone="good">deadline-bound</Pill></Artifact><Artifact icon={Boxes} eyebrow="Can finish by closing" title="36 independent records"><p>Batch request · 2¢ each</p><Pill>async</Pill></Artifact></div>
      <div className="mission-review-capacity"><SectionHeading icon={Users} eyebrow="Human review" title="14 available checks · 56 min" /><div className="mission-review-slots">{Array.from({ length: 14 }, (_, i) => <span key={i} aria-label={`Review slot ${i + 1}`} />)}</div></div>
      {position === 0 && <div className="mission-rush-preview"><b>Queue plan</b><span>{selected[0] === 1 ? "16 live + 36 batch · $1.52 · live deadline protected" : selected[0] === 0 ? "52 batch · live deadline missed" : selected[0] === 2 ? "52 live · $2.60 · four counter replies late" : "Select a route to preview cost and deadline impact."}</span></div>}
      {position === 1 && <div className="mission-rush-preview"><b>Restored order facts</b><span>{selected[0] === 1 ? "Each active order loads its confirmed date with the matching source ID." : selected[0] === 0 ? "A narrative summary can attach the most recent date to the wrong order." : selected[0] === 2 ? "Copying the full history still leaves similar vendors ambiguous." : "Choose how dates are recovered after compaction."}</span></div>}
      {position === 2 && <div className="mission-rush-preview"><b>Review plan</b><span>{selected[0] === 1 ? "12 handwriting cases + 2 stratified samples = 14 checks · 56 min." : selected[0] === 0 ? "32 lower-confidence checks need 128 min and still miss confident errors." : selected[0] === 2 ? "6 checks need 24 min, but four high-confidence errors pass." : "Fit the weak segment and calibration samples into the review window."}</span></div>}
    </div>
    <div className="mission-rush-controls"><SectionHeading icon={position === 0 ? Workflow : position === 1 ? Database : Users}
      eyebrow={position === 0 ? "Service lanes" : position === 1 ? "Verified order facts" : "Review allocation"}
      title={decision.station} />
      <MissionMechanic mission={mission} position={position} selected={selected} select={select} />
    </div>
  </div>;
}

type LabViewProps = { mission: Workbench; position: number; selected: number[]; select: (indices: number[]) => void };

function MissionBoard({ mission, position, selected, select }: LabViewProps) {
  switch (mission.id) {
    case "library-search": return <LibraryDesk mission={mission} position={position} selected={selected} select={select} />;
    case "community-handoff": return <BookingFlow mission={mission} position={position} selected={selected} select={select} />;
    case "release-review": return <MigrationBench mission={mission} position={position} selected={selected} select={select} />;
    case "repair-shop-tools": return <RepairTools mission={mission} position={position} selected={selected} select={select} />;
    case "printworks-ci": return <PrintworksGate mission={mission} position={position} selected={selected} select={select} />;
    case "market-close": return <MarketCloseBench mission={mission} position={position} selected={selected} select={select} />;
    case "dispatch-monday-peak": return <PeakDispatch mission={mission} position={position} selected={selected} select={select} />;
    case "market-rush": return <MarketRush mission={mission} position={position} selected={selected} select={select} />;
    default: return <RoleMissionBoard mission={mission} position={position} selected={selected} select={select} />;
  }
}

function FileCodeIcon() { return <Code2 size={15} aria-hidden="true" />; }

function ReplayRows({ mission, replay }: { mission: Workbench; replay: Replay }) {
  return <div className={`mission-replay-rows mission-replay-rows--${mission.id}`}>
    {replay.map((result) => {
      const decision = mission.decisions.find(({ objective }) => objective === result.objective)!;
        return <article className="mission-replay-row" key={result.objective}>
        <div className="mission-replay-row-head"><span>{result.passed ? <Check size={16} /> : <CircleAlert size={16} />}</span><div><strong>{decision.station}</strong><small>Objective {result.objective}</small></div><Pill tone={result.passed ? "good" : "warn"}>{result.passed ? "target met" : "needs adjustment"}</Pill></div>
        <p>{result.traces.join(" ")}</p>
      </article>;
    })}
  </div>;
}

function WorkloadReplay({ workload, baseline }: { workload: Workload; baseline: Workload }) {
  return <div className="mission-workload-replay">
    <div className="mission-workload-metrics"><div><span>Staff follow-up</span><b>{baseline.staffMinutes} → {workload.staffMinutes} min</b></div><div><span>Unresolved / incorrect</span><b>{baseline.unresolved} → {workload.unresolved}</b></div><div><span>Direct spend</span><b>${(baseline.cents / 100).toFixed(2)} → ${(workload.cents / 100).toFixed(2)}</b></div></div>
    <div className="mission-workload-rows">{workload.rows.map((row) => <div key={row.name}><strong>{row.name}</strong><span>{row.requests} requests</span><p>{row.outcome}</p></div>)}</div>
    <div className="mission-workload-goals">{workload.goals.map((goal) => <Pill key={goal.name} tone={goal.passed ? "good" : "warn"}>{goal.passed ? <Check size={13} /> : <CircleAlert size={13} />}{goal.name}</Pill>)}</div>
  </div>;
}

export function MissionLab({ mission, position, choices, run, saved, meetsGoals, replay, workload, baseWorkload, busy, error,
  onChoose, onPosition, onRun, onAdjust, onSave, onBackToEvidence }: MissionLabProps) {
  const experience = missionExperiences[mission.id]!;
  const decision = mission.decisions[position];
  const selected = decision ? choices[decision.objective] ?? [] : [];
  const complete = mission.decisions.every(({ objective, combine }) => (choices[objective] ?? []).length === (combine ? 2 : 1));
  const canAdvance = !!decision && selected.length === (decision.combine ? 2 : 1);

  return <section className={`mission-lab mission-lab--${mission.id}`} aria-labelledby="mission-lab-title" tabIndex={-1}>
    <header className="mission-lab-header">
      <div><p className="mission-lab-kicker"><span>{experience.room}</span><span>·</span><span>{mission.measure}</span></p><h3 id="mission-lab-title">{mission.title}</h3><p>{mission.brief}</p></div>
      <div className="mission-lab-record"><span>Assignment record</span><strong>{mission.workload}</strong></div>
    </header>
    {!run ? <>
      <nav className="mission-lab-stations" aria-label="Work stations">
        {mission.decisions.map((item, index) => {
          const savedCount = (choices[item.objective] ?? []).length;
          const done = savedCount === (item.combine ? 2 : 1);
          return <button type="button" key={item.objective} aria-current={position === index ? "step" : undefined} data-complete={done || undefined} onClick={() => onPosition(index)}>
            <span>{done ? <Check size={14} /> : String(index + 1).padStart(2, "0")}</span><span><small>Station {index + 1}</small><strong>{item.station}</strong></span>
          </button>;
        })}
      </nav>
      {decision && <>
        <div className="mission-lab-active-heading"><div><span>Station {position + 1} of {mission.decisions.length}</span><h4>{decision.station}</h4></div><Pill tone={decision.combine ? "warn" : "plain"}>{decision.combine ? "2 coordinated controls" : "1 system control"}</Pill></div>
        <StationEvidence decision={decision} />
          <MissionBoard mission={mission} position={position} selected={selected} select={onChoose} />
        <footer className="mission-lab-footer">
          <button className="mission-lab-back" type="button" onClick={onBackToEvidence}><ArrowRight size={16} />Return to case file</button>
          <span className="mission-lab-state">Selections save as you work.</span>
          {position < mission.decisions.length - 1
            ? <button className="button button-primary" type="button" disabled={!canAdvance} onClick={() => onPosition(position + 1)}>Next station <ArrowRight size={16} /></button>
            : <button className="button button-primary" type="button" disabled={!canAdvance || !complete} onClick={onRun}><Play size={16} />Run the assignment</button>}
        </footer>
      </>}
    </> : <>
      <div className="mission-lab-result-head"><div><p className="mission-lab-kicker">{workload ? workload.name : "Acceptance replay"}</p><h4>{saved ? "Saved city outcome" : meetsGoals ? "Configuration meets the assignment target" : "The work area needs another pass"}</h4></div><Pill tone={meetsGoals ? "good" : "warn"}>{meetsGoals ? "all targets met" : "adjust and rerun"}</Pill></div>
      {workload && baseWorkload ? <WorkloadReplay workload={workload} baseline={baseWorkload} /> : <ReplayRows mission={mission} replay={replay} />}
      <div className="mission-lab-footer mission-lab-footer--result">
        <button className="mission-lab-back" type="button" onClick={onBackToEvidence}><ArrowRight size={16} />Open case notes</button>
        <span className="mission-lab-state">Replays use the same authored case facts each time.</span>
        {saved ? <button className="button button-primary" type="button" onClick={onAdjust}>Revisit work area</button> : <>
          <button className="button button-outline" type="button" onClick={onAdjust}><SlidersHorizontal size={16} />Adjust configuration</button>
          {meetsGoals && <button className="button button-primary" type="button" disabled={busy} onClick={onSave}><BadgeCheck size={16} />Save assignment outcome</button>}
        </>}
      </div>
      {error && <p className="academy-error" role="alert">This browser could not save the assignment. Keep this work area open and try again.</p>}
      {saved && <p className="academy-positive" role="status">Assignment outcome saved to City impact.</p>}
    </>}
  </section>;
}

