"use client";

import {
  ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, ClipboardList, MapPin, Play, RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { places } from "../../lib/world";
import { dispatchProgressKey, meetsDispatchGoal, readDispatch, runShift } from "../../lib/shift";
import { assignments, isCityAssignment } from "../../lib/claude/assignments";
import {
  cityAssignmentHref, examMinutes, examRegistration, trackTitle,
} from "../../lib/claude/blueprints";
import type { Track } from "../../lib/claude/blueprints";
import { banks, createSession, domainEvidence, followupDue, itemDomain, rehearsalForms, score, sessionItems } from "../../lib/claude/practice";
import type { PracticeMode } from "../../lib/claude/practice";
import { emptyProgress, progressKey, readProgress, updateProgress } from "../../lib/claude/progress";
import { cityAssignmentKey, readCityAssignment } from "../../lib/claude/city-progress";
import { cityItemExposure, missionStoragePrefix, missionsFor, portfolioEvidence, readPortfolio } from "../../lib/claude/pathway";
import type { PortfolioRecords } from "../../lib/claude/pathway";
import { progressScope, subscribeToProgress } from "../../lib/progress-storage";
import { useAccount } from "../account";
import { ExternalLink, trackIcons } from "./chrome";
import { CapstoneWorkspace } from "./capstone-workspace";
import { DecemberWorkshop } from "./december-workshop";
import { EntryBridge } from "./entry-bridge";
import { GuideSkills } from "./guide-skills";
import { ReadinessPanel } from "./readiness-panel";
import { dateFormat, dueLabel, modeLabel, PracticeReview, PracticeSession } from "./session";
import { rehearsalFormLabel } from "../../lib/claude/assessment/forms";
import type { RehearsalForm } from "../../lib/claude/assessment/forms";
import { decemberBlueprint, decemberVersion, examGuideLabel, rehearsalBlueprint } from "../../lib/claude/december-blueprints";
import type { ExamVersion } from "../../lib/claude/december-blueprints";
import { caseworkFor } from "../../lib/claude/cases";
import { getCapstoneDefinition } from "../../lib/claude/capstones";
import { objectiveCoverage } from "../../lib/claude/curriculum";
import { bridges } from "../../lib/claude/curriculum/bridges";
import { benchmarkEvidence, emptyReadiness, readReadiness, readinessKey, updateReadiness } from "../../lib/claude/readiness";

type View = "overview" | "session" | "review";

function focusDomain(id: string) {
  const panel = document.getElementById(id) as HTMLDetailsElement | null;
  if (!panel) return false;
  panel.open = true;
  panel.querySelector("summary")?.focus({ preventScroll: true });
  panel.scrollIntoView({ block: "start" });
  return true;
}

export function TrackWorkspace({ track }: { track: Track }) {
  const { ready, user } = useAccount();
  const [view, setView] = useState<View>("overview");
  const [version, setVersion] = useState<ExamVersion>("july-2026");
  const [progress, setProgress] = useState(emptyProgress);
  const [readiness, setReadiness] = useState(emptyReadiness);
  const [readinessError, setReadinessError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [sessionOnly, setSessionOnly] = useState(false);
  const [assignmentComplete, setAssignmentComplete] = useState(false);
  const [cityRecords, setCityRecords] = useState<PortfolioRecords>({});
  const [timed, setTimed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [discard, setDiscard] = useState(false);
  const domainFocus = useRef<string | null>(null);
  const latest = useRef(emptyProgress);
  const pending = useRef<Promise<boolean>>(Promise.resolve(true));
  const latestReadiness = useRef(emptyReadiness);
  const pendingReadiness = useRef<Promise<boolean>>(Promise.resolve(true));
  const place = places.find(({ id }) => id === track.place)!;
  const isDispatch = track.id === "architect-foundations";
  const assignment = isCityAssignment(track.id) ? assignments[track.id] : null;
  const bank = banks[track.id];
  const cityExposure = cityItemExposure(track, cityRecords);
  const evidence = domainEvidence(track, progress.attempts, cityExposure);
  const starter = missionsFor(track.id).find(({ kind }) => kind === "original" || kind === "dispatch")!;
  const portfolio = portfolioEvidence(track, cityRecords, new Set(assignmentComplete ? [starter.id] : []));
  const starterComplete = portfolio.completed.some(({ id }) => id === starter.id);
  const starterCase = caseworkFor(starter.id);
  const december = decemberBlueprint(track);
  const revised = version === decemberVersion;
  const selectedBlueprint = rehearsalBlueprint(track, version);
  const forms = rehearsalForms(track.id, version, progress.attempts, [...cityExposure.keys(), ...(progress.seen ?? [])]);
  const benchmark = benchmarkEvidence(track, version, readiness, progress.attempts, now);
  const guided = new Set(readiness.guide);
  const passedSkills = (results?: typeof benchmark.practical.capstone) => new Set(results?.results.filter(({ passed }) => passed).flatMap(({ objectives }) => objectives));
  const caseSkills = passedSkills(benchmark.practical.capstone ?? benchmark.practical.firstCapstone);
  const delayedSkills = passedSkills(benchmark.practical.transfer ?? benchmark.practical.firstTransfer);
  const sampledSkills = (stage: "capstone" | "transfer") => new Set(getCapstoneDefinition(track.id, version, stage).criteria
    .flatMap(({ objectives, revisedObjectives }) => revised ? revisedObjectives ?? objectives : objectives));
  const caseSample = sampledSkills("capstone");
  const delayedSample = sampledSkills("transfer");
  const legacyCoverage = objectiveCoverage(track, "july-2026");
  const cityGuide = isDispatch ? "November" : "July";
  const domainProgress = objectiveCoverage(track, version).map(({ id, title, skills }) => ({
    id, title, objectives: skills.length,
    practiced: skills.filter((skill) => (revised ? guided : portfolio.applied).has(skill.id)).length,
    checked: revised ? null : skills.filter((skill) => portfolio.demonstrated.has(skill.id)).length,
    practical: skills.filter((skill) => caseSkills.has(skill.id)).length,
    practicalTotal: skills.filter((skill) => caseSample.has(skill.id)).length,
    delayed: skills.filter((skill) => delayedSkills.has(skill.id)).length,
    delayedTotal: skills.filter((skill) => delayedSample.has(skill.id)).length,
  }));
  const objectiveTotal = domainProgress.reduce((sum, entry) => sum + entry.objectives, 0);
  const objectivesPracticed = domainProgress.reduce((sum, entry) => sum + entry.practiced, 0);
  const due = followupDue(progress.attempts);
  const transferDue = benchmark.practical.transferDue;
  const followup = progress.attempts.find(({ mode }) => mode === "followup");
  const selectedAttempt = progress.attempts.find(({ id }) => id === reviewId);
  const Icon = trackIcons[track.id];
  const practiceCount = Math.min(bank.practice.length, 12);
  const pacing = Math.ceil(practiceCount * examMinutes / track.count);
  const focusHeading = useRef(false);

  useEffect(() => {
    if (!ready) return;
    function restore() {
      const value = readProgress(track) ?? emptyProgress;
      latest.current = value;
      setProgress(value);
      const savedReadiness = readReadiness(track) ?? emptyReadiness;
      latestReadiness.current = savedReadiness;
      setReadiness(savedReadiness);
      if (december && savedReadiness.version) setVersion(savedReadiness.version);
      setCityRecords(readPortfolio(user ? null : undefined));
      if (track.id === "architect-foundations") {
        const dispatch = readDispatch();
        setAssignmentComplete(!!dispatch && meetsDispatchGoal(runShift(dispatch.contract, dispatch.routes)));
      } else {
        setAssignmentComplete(!!readCityAssignment(track));
      }
    }
    restore();
    if (!latestReadiness.current.version) {
      setVersion(december && (latest.current.draft?.version === decemberVersion || Date.now() >= Date.parse("2026-12-07T00:00:00-06:00")) ? decemberVersion : "july-2026");
    }
    setLoaded(true);
    setNow(Date.now());
    if (window.location.hash === "#assignment") {
      window.location.replace(cityAssignmentHref(track));
    }
    const linkedDomain = Number(new URLSearchParams(window.location.search).get("domain"));
    if (track.domains.some(({ id }) => id === linkedDomain)) {
      requestAnimationFrame(() => focusDomain(`july-domain-${linkedDomain}`));
    }
    const refresh = () => setNow(Date.now());
    const unsubscribe = subscribeToProgress((key, local) => {
      if (!local && (key === progressKey(track) || key === readinessKey(track) || key === dispatchProgressKey || key === cityAssignmentKey(track) || key?.startsWith(missionStoragePrefix) || key === "simza.ccar-f.task-2.2.v1" || key === null)) restore();
    });
    window.addEventListener("focus", refresh);
    return () => {
      unsubscribe();
      window.removeEventListener("focus", refresh);
    };
  }, [track, ready, user, december]);

  useEffect(() => {
    const next = Math.min(...[due, transferDue].filter((date): date is number => date !== null && date > now));
    if (!Number.isFinite(next)) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(next - Date.now() + 25, 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [due, transferDue, now]);

  useEffect(() => {
    if (!focusHeading.current) return;
    focusHeading.current = false;
    if (view === "overview" && domainFocus.current !== null) {
      const focused = focusDomain(domainFocus.current);
      domainFocus.current = null;
      if (focused) return;
    }
    window.scrollTo(0, 0);
    const heading = document.querySelector<HTMLElement>(".academy-workspace h1");
    heading?.setAttribute("tabindex", "-1");
    heading?.focus({ preventScroll: true });
  }, [view, reviewId]);

  function navigate(next: View) {
    setError(null);
    if (next !== view) {
      focusHeading.current = true;
      setView(next);
    }
  }

  const save = useCallback((action: Parameters<typeof updateProgress>[2]) => {
    const scope = progressScope();
    const work = pending.current.then(async () => {
      if (progressScope() !== scope) return false;
      const result = await updateProgress(track, latest.current, action);
      latest.current = result.progress;
      setProgress(result.progress);
      setError(result.error);
      if (result.saved !== null) setSessionOnly(!result.saved);
      return result.error === null;
    });
    pending.current = work;
    return work;
  }, [track]);

  const present = useCallback((id: string, itemId: string) => {
    void save({ type: "present", id, itemId });
  }, [save]);

  function saveReadiness(action: Parameters<typeof updateReadiness>[2]) {
    const scope = progressScope();
    const work = pendingReadiness.current.then(async () => {
      if (scope !== progressScope()) return false;
      const result = await updateReadiness(track, latestReadiness.current, action);
      latestReadiness.current = result.progress;
      setReadiness(result.progress);
      setReadinessError(result.error ?? (result.saved ? null : "Browser storage is unavailable. This progress lasts until you leave the page."));
      setNow(Date.now());
      return result.error === null;
    });
    pendingReadiness.current = work;
    return work;
  }

  function selectVersion(examVersion: ExamVersion) {
    setVersion(examVersion);
    void saveReadiness({ type: "version", version: examVersion });
  }

  function showReview(id: string) {
    setReviewId(id);
    navigate("review");
  }

  async function start(mode: PracticeMode, domain: number | null = null, form?: RehearsalForm) {
    if (busy || !loaded) return;
    if (latest.current.draft) {
      setError("Resume or discard the saved session before starting another.");
      document.getElementById("practice-start")?.focus();
      document.getElementById("practice-controls")?.scrollIntoView({ block: "center" });
      return;
    }
    setBusy(true);
    const session = createSession(track, mode, domain, mode === "mixed" && timed, latest.current.attempts, Date.now(), [...cityExposure.keys(), ...(latest.current.seen ?? [])], version, form);
    if (await save({ type: "start", draft: session })) {
      navigate("session");
    }
    setBusy(false);
  }

  async function submit() {
    if (!progress.draft || busy) return;
    setBusy(true);
    const id = progress.draft.id;
    if (await save({ type: "submit", id }) && latest.current.attempts.some((entry) => entry.id === id)) {
      setNow(Date.now());
      showReview(id);
    }
    setBusy(false);
  }

  function practiceDomain(domain: number) {
    const reviewVersion = selectedAttempt?.version === decemberVersion ? decemberVersion : "july-2026";
    if (selectedAttempt?.mode === "assessment") setVersion(reviewVersion);
    domainFocus.current = `${reviewVersion === decemberVersion ? "december" : "july"}-domain-${domain}`;
    navigate("overview");
  }

  if (view === "session" && progress.draft) {
    return <PracticeSession track={track} session={progress.draft} error={error} busy={busy} onPresent={present}
      onMove={(id, index) => save({ type: "move", id, index })} onChoose={(id, itemId, value) => save({ type: "choose", id, itemId, value })} onSubmit={() => void submit()} onExit={() => navigate("overview")} />;
  }
  if (view === "review" && selectedAttempt) {
    return <PracticeReview track={track} attempt={selectedAttempt} due={due} onBack={() => navigate("overview")} onDomain={practiceDomain} />;
  }

  return (
    <main className="academy-width academy-workspace">
      <Link className="academy-back" href="/certifications"><ArrowLeft size={16} aria-hidden="true" /> All certifications</Link>
      <section className="academy-track-hero" data-track={track.id}>
        <div>
          <div className="academy-title-label"><span className="academy-track-icon"><Icon size={22} strokeWidth={1.7} aria-hidden="true" /></span><span className="academy-code">{track.code}</span></div>
          <h1>{trackTitle(track)}</h1>
          <p>{track.description}</p>
        </div>
        <dl className="academy-exam-data" aria-label="Official exam details">
          <div><dt>Exam questions</dt><dd>{selectedBlueprint.count}</dd></div>
          <div><dt>Time limit</dt><dd>{examMinutes} min</dd></div>
          <div><dt>Exam fee</dt><dd>${track.fee} USD</dd></div>
        </dl>
      </section>
      <div className="academy-blueprint-line">
        <span>{examGuideLabel(track, version)}</span>
        <ExternalLink href={selectedBlueprint.guide}>Official exam guide</ExternalLink>
      </div>
      {december && <fieldset className="academy-exam-version">
        <legend>When are you taking the exam?</legend>
        <label><input type="radio" name="exam-version" checked={version === "july-2026"} onChange={() => selectVersion("july-2026")} />Before December 7</label>
        <label><input type="radio" name="exam-version" checked={version === decemberVersion} onChange={() => selectVersion(decemberVersion)} />December 7 or later</label>
      </fieldset>}
      <nav className="academy-pathway-links" aria-label="Learning pathway">
        <a href="#entry-bridge" onClick={() => { const entry = document.getElementById("entry-bridge") as HTMLDetailsElement | null; if (entry) entry.open = true; }}>Start here</a>
        <Link href={cityAssignmentHref(track)}>City assignments</Link>
        <a href={revised ? "#guide-skills" : "#domain-title"}>Practice by domain</a>
        <a href="#track-practicals">Practical cases</a>
        <a href="#rehearsal">Timed forms</a>
      </nav>
      <section className="academy-panel academy-assignment-card academy-first-assignment" aria-labelledby="track-assignment">
        <div>
          <p className="academy-kicker"><MapPin size={15} aria-hidden="true" /> {place.name}</p>
          <h2 id="track-assignment">{track.assignment}</h2>
          <p>{cityRecords[starter.id]?.casework && starterCase ? starterCase.retest.done : assignmentComplete && assignment ? assignment.impact : bridges[track.id].mission}</p>
          {starterComplete && <p className="academy-positive"><Check size={16} aria-hidden="true" /> First assignment saved</p>}
        </div>
        <Link className="academy-button secondary" href={starterComplete ? cityAssignmentHref(track) : `${cityAssignmentHref(track)}&mission=${starter.id}`}>
          {starterComplete ? "Continue in the city" : "Open your first assignment"} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>
      {readinessError && <p className="academy-error" role="alert">{readinessError}</p>}
      <div className="academy-track-layout">
        <div className="academy-main-column">
          {loaded && <EntryBridge key={user?.id ?? "guest"} track={track} saved={readiness.bridge} onSave={(choices) => saveReadiness({ type: "bridge", choices })} />}
          <section className="academy-panel academy-pathway-progress" aria-labelledby="overall-progress-heading">
            <h2 id="overall-progress-heading">Learning progress</h2>
            <dl>
              <div><dt>City assignments saved</dt><dd>{portfolio.completed.length}/{portfolio.missions.length}</dd></div>
              <div><dt>{revised ? "December guided objectives practiced" : `${cityGuide} guide objectives applied`}</dt><dd>{objectivesPracticed}/{objectiveTotal}</dd></div>
              <div><dt>{cityGuide} objectives correct on a first-seen city check</dt><dd>{portfolio.demonstrated.size}</dd></div>
              <div><dt>Practical cases passed for this guide</dt><dd>{Number(!!benchmark.practical.capstone) + Number(!!benchmark.practical.transfer)}/2</dd></div>
            </dl>
          </section>
          <ReadinessPanel evidence={benchmark} domains={domainProgress} revised={revised} now={now}
            onDomain={(id) => focusDomain(`${revised ? "december" : "july"}-domain-${id}`)} />
          {revised && <>
            <GuideSkills key={`${track.id}:${user?.id ?? "guest"}`} track={track} practiced={guided} onPractice={(objective) => saveReadiness({ type: "guide", objective })} />
            <DecemberWorkshop track={track.id} completed={readiness.workshop} onComplete={() => void saveReadiness({ type: "workshop" })} />
          </>}
          {loaded && <CapstoneWorkspace key={`${version}:${user?.id ?? "guest"}`} track={track} version={version} attempts={readiness.capstones}
            onSubmit={(attempt) => saveReadiness({ type: "submission", attempt })} />}
          <section className="academy-panel academy-start-panel" id="practice-controls" aria-labelledby="practice-title">
            <div className="academy-section-heading">
              <h2 id="practice-title">{progress.draft ? "Resume practice" : "Mixed practice"}</h2>
              <ClipboardList size={22} strokeWidth={1.65} aria-hidden="true" />
            </div>
            {progress.draft ? (
              <>
                <p>{modeLabel(track, progress.draft)} · {progress.draft.itemIds.length} questions{progress.draft.mode === "assessment" && ` · ${examGuideLabel(track, progress.draft.version)}`}</p>
                {discard
                  ? <div className="academy-actions">
                    <button className="academy-button secondary" disabled={busy} onClick={async () => {
                      setBusy(true);
                      if (progress.draft) await save({ type: "discard", id: progress.draft.id });
                      setDiscard(false);
                      setBusy(false);
                    }}>Discard saved session</button>
                    <button className="academy-button text" onClick={() => setDiscard(false)}>Keep session</button>
                  </div>
                  : <div className="academy-actions">
                    <button id="practice-start" className="academy-button primary" onClick={() => navigate("session")}><Play size={16} aria-hidden="true" /> Resume session</button>
                    <button className="academy-button text" onClick={() => setDiscard(true)}>Discard session</button>
                  </div>}
              </>
            ) : (
              <>
                <p>{practiceCount} questions across {track.domains.length} {revised ? "July guide " : ""}domains. Review your answers and sources after submitting.</p>
                <div className="academy-actions">
                  <button id="practice-start" className="academy-button primary" disabled={busy || !loaded} onClick={() => void start("mixed")}>Start mixed practice <ArrowRight size={16} aria-hidden="true" /></button>
                  <label className="academy-timed"><input type="checkbox" checked={timed} onChange={(event) => setTimed(event.target.checked)} /> Timed · {pacing} min</label>
                </div>
              </>
            )}
            {error && <p className="academy-error" role="alert">{error}</p>}
            {sessionOnly && <p className="academy-error" role="status">Browser storage is unavailable. This progress lasts until you leave the page.</p>}
          </section>
          <section className="academy-panel academy-rehearsal-forms" id="rehearsal" aria-labelledby="rehearsal-title">
            <h2 id="rehearsal-title">Timed exam rehearsals</h2>
            <p>Each form has {examMinutes} minutes and results by exam domain. Save a fresh form for after you review weaker domains.</p>
            {revised && <p>Each form has 60 scored and 10 unscored questions. See feedback for every question after submitting.</p>}
            {forms.map(({ form, items, exposed, completed }) => items.length > 0 && <div key={form} className="academy-rehearsal">
              <div>
                <h3>{rehearsalFormLabel(form)}</h3>
                <p>{items.length} questions · {exposed ? `${exposed} previously seen` : "Fresh questions"}{completed && " · Completed"}</p>
              </div>
              <button type="button" className="academy-button primary" disabled={busy || !loaded || !!progress.draft}
                onClick={() => void start("assessment", null, form)}>{completed ? "Repeat" : "Start"} {rehearsalFormLabel(form).toLowerCase()} <ArrowRight size={16} aria-hidden="true" /></button>
            </div>)}
          </section>
          <section className="academy-domain-section" aria-labelledby="domain-title">
            <div className="academy-section-heading">
              <h2 id="domain-title">{revised ? "Practice by July domain" : "Practice by domain"}</h2>
              <span>{evidence.reviewed.size} / {bank.practice.length} questions practiced</span>
            </div>
            <div className="academy-domain-list">
              {legacyCoverage.map((domain) => {
                const items = bank.practice.filter((entry) => itemDomain(entry) === domain.id);
                const available = new Set(items.map(({ objective }) => objective));
                const practiced = evidence.firstObjectives.get(domain.id) ?? new Set();
                const count = evidence.domainCounts.get(domain.id) ?? 0;
                return (
                  <details key={domain.id} className="academy-domain" id={`july-domain-${domain.id}`}>
                    <summary><span><strong>{domain.title}</strong><small>{items.length} {items.length === 1 ? "question" : "questions"} · {available.size}/{domain.objectives.length} objectives in the bank{count ? ` · ${evidence.domainScores.get(domain.id) ?? 0}/${count} correct first-seen in practice` : ""}</small></span><span className="academy-weight">{domain.weight}%</span><ChevronDown size={17} aria-hidden="true" /></summary>
                    <div className="academy-domain-body">
                      <p>{domain.objectives.filter((_, i) => portfolio.applied.has(`${domain.id}.${i + 1}`)).length}/{domain.objectives.length} applied in city work
                        {" · "}{domain.objectives.filter((_, i) => portfolio.demonstrated.has(`${domain.id}.${i + 1}`)).length}/{domain.objectives.length} correct on a first-seen check</p>
                      <ul className="academy-objectives">
                        {domain.skills.map(({ id: code, title: name, missions }) => (
                          <li key={code} className="academy-mapped-skill">
                            <div><span>{code} · {name}</span>
                              <div className="academy-mission-links">{missions.map((mission) => <Link key={mission.id} href={`${cityAssignmentHref(track)}&mission=${mission.id}`}>{mission.title}</Link>)}</div>
                            </div>
                            <span>{portfolio.demonstrated.has(code) ? "Check correct" : practiced.has(code) ? "Practiced" : portfolio.applied.has(code) ? "Applied in city" : available.has(code) ? "Available" : "In exam guide"}</span>
                          </li>
                        ))}
                      </ul>
                      <button className="academy-button secondary" disabled={busy || !loaded} onClick={() => void start("domain", domain.id)}>Practice this domain <ArrowRight size={16} aria-hidden="true" /></button>
                    </div>
                  </details>
                );
              })}
            </div>
          </section>
        </div>
        <aside className="academy-sidebar" aria-label="Follow-up and official resources">
          <section className="academy-panel">
            <div className="academy-section-heading"><h2>{revised ? "July practice follow-up" : "Seven-day follow-up"}</h2><RotateCcw size={19} strokeWidth={1.7} aria-hidden="true" /></div>
            <p>{followup ? "Your follow-up results are saved." : due === null ? "Submit mixed practice to unlock a new set of scenarios seven days later." : due > now ? `Available ${dueLabel(due)}.` : `${bank.followup.length} new scenarios are ready.`}</p>
            {followup
              ? <button className="academy-button secondary" onClick={() => showReview(followup.id)}>Review follow-up <ArrowRight size={16} aria-hidden="true" /></button>
              : due !== null && due <= now && <button className="academy-button secondary" disabled={busy} onClick={() => void start("followup")}>Start follow-up <ArrowRight size={16} aria-hidden="true" /></button>}
          </section>
          {!!progress.attempts.length && (
            <section className="academy-panel academy-history">
              <h2>Practice history</h2>
              <ul>
                {[...progress.attempts].reverse().map((attempt) => {
                  const items = sessionItems(track, attempt).filter((item) => !item.pilot);
                  return <li key={attempt.id}><button onClick={() => showReview(attempt.id)}>
                    <span><strong>{modeLabel(track, attempt)}{attempt.mode === "assessment" && ` · ${examGuideLabel(track, attempt.version)}`}</strong><small>{dateFormat.format(attempt.submittedAt)}</small></span>
                    <span>{score(items, attempt.answers)}/{items.length} <ArrowRight size={15} aria-hidden="true" /></span>
                  </button></li>;
                })}
              </ul>
            </section>
          )}
          <section className="academy-panel academy-official">
            <div className="academy-section-heading"><h2>Official resources</h2><BookOpen size={19} strokeWidth={1.7} aria-hidden="true" /></div>
            <ExternalLink href={track.prep}>Anthropic prep courses</ExternalLink>
            <ExternalLink href={examRegistration(track)}>Exam registration</ExternalLink>
            <p>Registration requires a Claude Partner Network account. {user ? "Practice progress syncs to your CertCity account." : "Guest practice progress is stored on this device."}</p>
          </section>
        </aside>
      </div>
    </main>
  );
}
