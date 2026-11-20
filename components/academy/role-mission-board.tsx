import {
  Activity, Archive, ArrowRight, BadgeCheck, BookOpen, Braces, BriefcaseBusiness,
  Check, ClipboardCheck, ClipboardList, Clock3, Code2, Database, FileCheck2, FileClock, FileSearch,
  FileText, GitBranch, GitPullRequest, Hand, LockKeyhole, Mail, MessageSquareText, Network, Package,
  Play, Search, ShieldCheck, SlidersHorizontal, Sparkles, Table2, Terminal, Timer, Truck, Users,
  Workflow, Wrench, X,
} from "lucide-react";
import type { Mission } from "../../lib/claude/missions";
import { MissionMechanic } from "./role-mission-mechanic";

type Workbench = Extract<Mission, { kind: "workbench" }>;
type Props = { mission: Workbench; position: number; selected: number[]; select: (indices: number[]) => void };

function Panel({ icon: Icon, label, title, children }: { icon: typeof FileText; label: string; title: string; children?: React.ReactNode }) {
  return <section className="role-scene-panel"><header><Icon size={18} aria-hidden="true" /><div><small>{label}</small><strong>{title}</strong></div></header>{children && <div className="role-scene-body">{children}</div>}</section>;
}

function OrderlySteps({ items }: { items: string[] }) {
  return <div className="role-steps">{items.map((item, index) => <div key={item}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item}</strong>{index < items.length - 1 && <ArrowRight size={15} aria-hidden="true" />}</div>)}</div>;
}

function DataRow({ title, value, state }: { title: string; value: string; state?: "good" | "warn" | "bad" }) {
  return <div className="role-data-row"><strong>{title}</strong><span>{value}</span>{state && <i data-state={state}>{state === "good" ? "ready" : state === "bad" ? "blocked" : "review"}</i>}</div>;
}

export function RoleMissionBoard({ mission, position, selected, select }: Props) {
  const decision = mission.decisions[position];
  const controls = <MissionMechanic key={decision.objective} mission={mission} position={position} selected={selected} select={select} />;
  switch (mission.id) {
    case "market-bulletin": return <div className="role-mission-board role-board--bulletin">
      <div className="role-bulletin-desk"><Panel icon={Mail} label="Friday issue · draft" title="Vendor bulletin"><div className="role-paper"><b>Confirmed hours</b><span>Approved schedule facts</span><hr /><b>Pending changes</b><span>Two forms need approval</span><footer>Draft · approval required</footer></div></Panel>
        <Panel icon={ClipboardCheck} label="Manager desk" title="Approval log"><DataRow title="Submitted forms" value="20 forms · source IDs available" /><DataRow title="Operating hours" value="Inez approves changes" state="warn" /></Panel></div>{controls}</div>;
    case "library-desk": return <div className="role-mission-board role-board--library-desk">
      <div className="role-library-workspace"><Panel icon={BookOpen} label="Shared reference workspace" title="Four librarian desks"><DataRow title="Approved FAQ" value="Stable reference material" state="good" /><DataRow title="Glossary" value="Changes monthly" state="warn" /><DataRow title="Circulation folder" value="Restricted records nearby" state="bad" /></Panel>
        <Panel icon={Database} label="Connector boundary" title="Public programs"><div className="role-access-ring"><span><ShieldCheck size={18} />Approved program data</span><ArrowRight /><span><X size={18} />Circulation records</span></div></Panel>
        <Panel icon={FileText} label="New chat" title="Fresh answer context"><p>Durable source and behavior rules should be available without carrying an unrelated resident case.</p></Panel></div>{controls}</div>;
    case "school-notice-pilot": return <div className="role-mission-board role-board--school-pilot">
      <div className="role-school-desk"><Panel icon={ClipboardList} label="Family front office" title={position === 3 ? "Notice intake form" : position === 0 ? "Tone and required content" : position === 1 ? "Survey evidence" : "Pilot target"}>
          {position === 0 && <><DataRow title="Verified missing-document list" value="Dropped by the warmer draft" state={selected[0] === 1 ? "good" : "warn"} /><DataRow title="Tone" value="Can change without changing facts" state="good" /></>}
          {position === 1 && <><DataRow title="Responses" value="30 · weekday families only" state="warn" /><DataRow title="Weekend preference" value="Not measured" state="warn" /></>}
          {position === 2 && <><DataRow title="Main rework cause" value="Incomplete dates" state="warn" /><DataRow title="Approval timing" value="Fixed this term" /></>}
          {position === 3 && <><DataRow title="Date field" value="Currently allows empty input" state={selected[0] === 1 ? "good" : "warn"} /><DataRow title="Referral rule" value="Must remain unchanged" state="good" /></>}
          {position === 4 && <><DataRow title="Drafting" value="12 → 5 min" /><DataRow title="Review" value="2 → 6 min" state="warn" /><DataRow title="Corrections" value="2 of 30 replies" state="warn" /></>}
        </Panel>
        <Panel icon={Activity} label="Pilot record" title="Compare under the same service rule"><div className="role-metric-pair"><b>Completeness <span>same referral rule</span></b><b>Staff effort <span>include review</span></b><b>Evidence <span>retain corrections</span></b></div></Panel></div>{controls}</div>;
    case "library-activity-kit": return <div className="role-mission-board role-board--activity-kit">
      <div className="role-kit-bench"><Panel icon={Sparkles} label="Program planning" title="Idea cards"><DataRow title="Summer activity proposals" value="Explore within constraints" state="good" /><DataRow title="Board approvals" value="Use signed minutes only" state="warn" /></Panel>
        <div className="role-kit-arrow"><ArrowRight /><span>Verified facts and IDs</span><ArrowRight /></div>
        <Panel icon={Package} label="Two outputs" title="Staff kit + catalog import"><div className="role-output-cards"><span><FileText />Editable activity kit</span><span><Braces />Structured program ID array</span></div></Panel>
        <Panel icon={Database} label="Handoff" title="Fresh team chat"><p>Carry verified dates and source IDs; leave unrelated brainstorming in its own context.</p></Panel></div>{controls}</div>;
    case "kitchen-billing-audit": return <div className="role-mission-board role-board--billing-audit">
      <div className="role-billing-bench"><Panel icon={Table2} label="Supplier export comparison" title="Matched rows · same model and prompt"><div className="role-diff-table"><div><b>Previous export</b><b>Current export</b></div><div><span>Refund amount is negative</span><span>Refund amount is positive</span></div><div><span>Refund represented by sign</span><span>Type field marks <code>R</code></span></div></div></Panel>
        <Panel icon={FileCheck2} label="Correction log" title="Known repeat defects"><DataRow title="Reviewed drafts citing withdrawn rule" value="9 drafts" state="bad" /><DataRow title="Stable instructions retyped per shift" value="6 instructions" state="warn" /></Panel>
        <Panel icon={Timer} label="Evaluation" title="Measure more than generation speed"><p>Track omissions, staff review time, and the cost of routing routine and ambiguous records.</p></Panel></div>{controls}</div>;
    case "community-policy": return <div className="role-mission-board role-board--community-policy">
      <div className="role-community-process"><Panel icon={Workflow} label="Application queue" title="Where cases wait"><OrderlySteps items={["Complete request", "Missing-date follow-up", "Staff award decision"]} /><p>Complete requests take a day; missing-date cases take twice as long. Drafting is ten minutes.</p></Panel>
        <Panel icon={LockKeyhole} label="Before external processing" title="Purpose and data boundary"><DataRow title="Addresses and medical details" value="Redact locally" state="bad" /><DataRow title="Topic-bearing excerpts" value="Allowed in approved workspace" state="good" /><DataRow title="Other program mailbox" value="Written approval required" state="warn" /></Panel>
        <Panel icon={Users} label="Decision authority" title="Training awards"><p>Staff select every limited award and record the reason. Claude may organize cited evidence for review.</p></Panel></div>{controls}</div>;
    case "permit-agent": return <div className="role-mission-board role-board--permit-agent">
      <div className="role-intake-console"><Panel icon={Workflow} label="Permit intake · fixed order" title="Validation before acknowledgment"><OrderlySteps items={["Address check", "Eligibility check", "Draft acknowledgment"]} /><p>The two checks precede drafting. Reconciliation runs overnight and uses a different deadline.</p></Panel>
        <Panel icon={Code2} label="Tool transcript" title="Two independent lookups"><DataRow title="Assistant turn" value="Two tool_use calls + preamble" state="warn" /><DataRow title="Tool result A" value="Must match its call ID" /><DataRow title="Tool result B" value="Must match its call ID" /></Panel>
        <Panel icon={LockKeyhole} label="Shared clerk console" title="Resume boundary"><p>Load only the authorized history associated with a verified case ID.</p></Panel></div>{controls}</div>;
    case "printworks-stream": return <div className="role-mission-board role-board--stream">
      <div className="role-stream-console"><Panel icon={Activity} label="Captured provider response" title="SDK has the complete message"><div className="role-stream-line"><span>event</span><span>event</span><span>event</span><span>complete response</span></div><p>Replaying fragmented events isolates the client decoder from the model and prompt.</p></Panel>
        <Panel icon={Network} label="Transport boundary" title="Backend to authenticated browser"><OrderlySteps items={["Provider SDK", "Backend event translation", "Authenticated WebSocket", "Proof console"]} /></Panel>
        <Panel icon={FileText} label="Repository rule" title="Two proof test paths"><DataRow title="Project rule" value="Scoped to proof tests in both packages" state="good" /><DataRow title="Unrelated code" value="Should not load the rule" /></Panel></div>{controls}</div>;
    case "vendor-batch-api": return <div className="role-mission-board role-board--batch-api">
      <div className="role-queue-station"><Panel icon={Timer} label="Counter lane" title="Live acknowledgment"><div className="role-deadline-badge"><Clock3 />6-second target</div><p>One urgent answer cannot wait behind the archive.</p></Panel>
        <Panel icon={Archive} label="Archive lane" title="Message Batches"><p>Independent records can complete overnight. Keep successful rows while retrying eligible failures.</p><div className="role-id-strip"><span>custom_id</span><ArrowRight /><span>result row</span><ArrowRight /><span>upsert</span></div></Panel>
        <Panel icon={FileSearch} label="Extraction fixture" title="Vendor ID field"><DataRow title="Unreadable" value="Different from blank" state="warn" /><DataRow title="Blank" value="Explicit missing value" /></Panel></div>{controls}</div>;
    case "library-workers": return <div className="role-mission-board role-board--library-workers">
      <div className="role-worker-room"><Panel icon={Users} label="Parallel research" title="One collection per worker"><div className="role-worker-cards"><article><b>Collection A</b><span>Boundary · dates · accession · citations</span></article><article><b>Collection B</b><span>Boundary · dates · accession · citations</span></article></div></Panel>
        <Panel icon={Database} label="MCP catalog" title="Resource or tool"><div className="role-interface-compare"><span><BookOpen />Policy by URI<br /><b>Resource</b></span><span><Search />Parameterized live search<br /><b>Tool</b></span></div></Panel>
        <Panel icon={Sparkles} label="Shared procedure" title="Skill + authorized lookup"><p>Keep the repeatable workflow reusable while retrieving current catalog information through the authorized connector.</p></Panel></div>{controls}</div>;
    case "repair-desk-safety": return <div className="role-mission-board role-board--repair-safety">
      <div className="role-repair-control"><Panel icon={FileText} label="Supplier PDF" title="Document is evidence, not authority"><div className="role-security-flow"><span>Untrusted source text</span><ArrowRight /><span>Draft proposal</span><ArrowRight /><b>Staff approval</b><ArrowRight /><span>Shared endpoint</span></div></Panel>
        <Panel icon={ShieldCheck} label="Pre-action checks" title="Validate before execution"><DataRow title="Resolved cleanup path" value="Must stay in selected project" state="warn" /><DataRow title="Approval check" value="At endpoint for every caller" state="good" /><DataRow title="Supplier result" value="Empty and upstream unavailable differ" state="warn" /></Panel>
        <Panel icon={LockKeyhole} label="Environment setup" title="Separate credentials"><div className="role-key-cards"><span>Staging · independently revocable</span><span>Production · separate server-held key</span></div></Panel></div>{controls}</div>;
    case "developer-release": return <div className="role-mission-board role-board--dev-release">
      <div className="role-release-room"><Panel icon={GitPullRequest} label="Release candidate" title="Pinned configuration"><DataRow title="Resolved model ID" value="Versioned" /><DataRow title="Prompt + settings" value="Pinned for replay" /><DataRow title="Source commit" value="Recorded with results" /></Panel>
        <Panel icon={Activity} label="Labeled evaluation" title="Repeat runs and slice checks"><div className="role-release-slices"><span>Routine inputs</span><span>Ambiguous inputs</span><span>Address corrections</span></div></Panel>
        <Panel icon={ShieldCheck} label="Reversible release" title="Staged prompt change"><OrderlySteps items={["Pin current", "Test affected slice", "Canary", "Switch back if regressed"]} /></Panel></div>{controls}</div>;
    case "public-permit-discovery": return <div className="role-mission-board role-board--permit-discovery">
      <div className="role-service-map"><Panel icon={BriefcaseBusiness} label="Permit service · applicant journey" title="Find the actual wait"><OrderlySteps items={["Submit form", "Request missing attachment", "Review eligibility", "Issue with approval"]} /><div className="role-time-cards"><span>Turnaround · six days</span><span>Drafting · ten minutes</span><span>Incomplete forms · twice the wait</span></div></Panel>
        <Panel icon={Users} label="Owner interview notes" title="Visible status and approval"><DataRow title="Support owner" value="Stale status reports" state="warn" /><DataRow title="Policy owner" value="Limit changes shown before sign-off" state="good" /></Panel>
        <Panel icon={Table2} label="Cost per resolution" title="Include retries and service outcome"><div className="role-cost-compare"><span>Route A · 1¢ + 3¢ retry on half</span><span>Route B · 2.2¢</span><b>Compare complete cost and SLA</b></div></Panel></div>{controls}</div>;
    case "library-retrieval-architecture": return <div className="role-mission-board role-board--retrieval">
      <div className="role-retrieval-room"><Panel icon={Search} label="Archive query types" title="Exact ID and description"><div className="role-query-lanes"><span>Accession number <b>lexical match needed</b></span><span>Procedure description <b>semantic match needed</b></span></div></Panel>
        <Panel icon={Workflow} label="Trace view" title="Measure each retrieval stage"><OrderlySteps items={["Ingest + revision", "Index", "Retrieve", "Rerank", "Answer"]} /><p>Carry trace IDs and timings; keep case contents out of logs.</p></Panel>
        <Panel icon={Archive} label="Source integrity" title="Procedure context"><DataRow title="Revision header" value="Must stay with its section" state="warn" /><DataRow title="Collection metadata" value="Needed to interpret the retrieved procedure" state="good" /></Panel></div>{controls}</div>;
    case "professional-eval-gate": return <div className="role-mission-board role-board--eval-gate">
      <div className="role-eval-console"><Panel icon={Activity} label="Release dashboard" title="Independent operating signals"><div className="role-eval-metrics"><span>Accuracy</span><span>Escalation errors</span><span>p95 latency</span><span>Cost per resolution</span></div></Panel>
        <Panel icon={GitPullRequest} label="Canary control" title="Eligible traffic"><div className="role-canary-bar"><i /><span>5% exposure available</span></div><p>Randomize eligible cases and keep a separate escalation rollback boundary.</p></Panel>
        <Panel icon={Users} label="Evaluation room" title="Human review where judgment matters"><DataRow title="Required fields" value="Exact automated check" state="good" /><DataRow title="Grounding + handoff" value="Calibrated human review" state="warn" /><DataRow title="New attachment layout" value="Sample labeled outcomes by layout" state="warn" /></Panel></div>{controls}</div>;
    case "market-scale": return <div className="role-mission-board role-board--market-scale">
      <div className="role-token-bench"><Panel icon={Activity} label="Candidate comparison" title="Check all operating limits"><div className="role-model-table"><div><b>Candidate</b><b>Quality</b><b>Cost</b><b>p95</b></div><div><strong>A</strong><span>95%</span><span>$0.01</span><span>1.6 s</span></div><div><strong>B</strong><span>98%</span><span>$0.04</span><span>2.8 s</span></div><footer>Targets · 94% · $0.02 · under 2 s</footer></div></Panel>
        <Panel icon={Database} label="Context assembly" title="Stable prefix before variable facts"><div className="role-context-blocks"><span>Approved policy + rubric</span><ArrowRight /><span>Team metadata + request</span></div><p>Persist verified claims with source IDs; retrieve only the active case subset.</p></Panel>
        <Panel icon={FileCheck2} label="Held-out examples" title="Waived field vs missing field"><DataRow title="Waived by policy" value="Not the same as required-but-missing" state="warn" /><DataRow title="Cache regression" value="Compare matched runs around the breakpoint" /></Panel></div>{controls}</div>;
    case "tenant-tools": return <div className="role-mission-board role-board--tenant-tools">
      <div className="role-identity-map"><Panel icon={LockKeyhole} label="Verified caller" title="Tenant scope from identity"><div className="role-identity-flow"><span>Signed-in identity</span><ArrowRight /><b>Server-side tenant scope</b><ArrowRight /><span>Scoped search results</span></div></Panel>
        <Panel icon={Wrench} label="Capability registry" title="Tools by task family"><DataRow title="Triage" value="Required read capabilities" state="good" /><DataRow title="Current agent list" value="40 tools · includes payroll and writes" state="bad" /><DataRow title="Nightly CSV transfer" value="Existing bulk API" state="good" /></Panel>
        <Panel icon={Search} label="Discovery" title="Authorized capabilities only"><p>Discover the relevant tools for this task; enforce the same scope where the service executes.</p></Panel></div>{controls}</div>;
    case "community-controls": return <div className="role-mission-board role-board--community-controls">
      <div className="role-governance-map"><Panel icon={Network} label="Production data path" title="Track every retained copy"><OrderlySteps items={["Source database", "Prompt / model", "Diagnostics", "Derived output"]} /><p>These stores have separate retention surfaces.</p></Panel>
        <Panel icon={ShieldCheck} label="Action boundary" title="Draft · approval · write"><div className="role-security-flow"><span>Untrusted evidence</span><ArrowRight /><span>Draft</span><ArrowRight /><b>Required operator approval</b><ArrowRight /><span>Verified service write</span></div><DataRow title="Sensitive account" value="Second approval required" state="warn" /></Panel>
        <Panel icon={Activity} label="Failure state" title="Unavailable is not empty"><DataRow title="Completed search with no match" value="Successful empty result" state="good" /><DataRow title="Upstream outage" value="Unavailable · uncertainty shown" state="warn" /></Panel></div>{controls}</div>;
    case "regional-operations": return <div className="role-mission-board role-board--regional-ops">
      <div className="role-ops-wall"><Panel icon={FileClock} label="Incoming on-call" title="Ten-minute outage route"><OrderlySteps items={["Alert named owner", "Open staffed manual queue", "Route by failure stage", "Review quality after recovery"]} /></Panel>
        <Panel icon={ClipboardList} label="Deployed system record" title="Reproduce the current behavior"><DataRow title="Data flow + control versions" value="Needed for handoff" /><DataRow title="Failure fixtures" value="Success and outage cases" /><DataRow title="Owners" value="Named for each service stage" /></Panel>
        <Panel icon={Users} label="Scoped specialist work" title="Synthesis with unresolved conflicts"><DataRow title="Source IDs" value="Preserve with each claim" state="good" /><DataRow title="Conflicts and gaps" value="Return to the coordinator" state="warn" /></Panel></div>{controls}</div>;
    default: return <div className="role-mission-board role-board--unmapped"><Panel icon={ClipboardList} label="Assignment case" title={decision.station}><p>{decision.evidence}</p></Panel>{controls}</div>;
  }
}
