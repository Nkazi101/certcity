"use client";

import {
  ArrowRight, Check, ChevronDown, Play,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { places } from "../../lib/world";
import { dispatchProgressKey, meetsDispatchGoal, readDispatch, runShift } from "../../lib/shift";
import { assignments, isCityAssignment } from "../../lib/claude/assignments";
import {
  cityAssignmentHref, examMinutes, examRegistration, trackHref, tracks, trackTitle,
} from "../../lib/claude/blueprints";
import type { Track } from "../../lib/claude/blueprints";
import { createSession, domainEvidence, followupDue, itemDomain, practiceBank, reassessmentItems, rehearsalForms, score, sessionItems } from "../../lib/claude/practice";
import type { PracticeMode } from "../../lib/claude/practice";
import { emptyProgress, progressKey, readProgress, updateProgress } from "../../lib/claude/progress";
import { cityAssignmentKey, readCityAssignment } from "../../lib/claude/city-progress";
import { cityItemExposure, missionStoragePrefix, missionsFor, portfolioEvidence, readPortfolio } from "../../lib/claude/pathway";
import type { PortfolioRecords } from "../../lib/claude/pathway";
import { progressScope, subscribeToProgress } from "../../lib/progress-storage";
import { recordPracticeMilestone } from "../../lib/practice-measurement";
import { useAccount } from "../account";
import { ExternalLink } from "./chrome";
import { CapstoneWorkspace } from "./capstone-workspace";
import { DecemberWorkshop } from "./december-workshop";
import { EntryBridge } from "./entry-bridge";
import { GuideSkills } from "./guide-skills";
import { ReadinessPanel } from "./readiness-panel";
import { TodayWork } from "../today/today-work";
import { useTodaysWork } from "../today/use-today";
import type { TodayItem } from "../../lib/today/plan";
import { dateFormat, dueLabel, modeLabel, PracticeReview, PracticeSession } from "./session";
import { rehearsalFormLabel } from "../../lib/claude/assessment/forms";
import type { RehearsalForm } from "../../lib/claude/assessment/forms";
import { decemberBlueprint, decemberVersion, examGuideLabel, rehearsalBlueprint } from "../../lib/claude/december-blueprints";
import type { ExamVersion } from "../../lib/claude/december-blueprints";
import { caseworkFor } from "../../lib/claude/cases";
import { getCapstoneDefinition } from "../../lib/claude/capstones";
import { objectiveCoverage } from "../../lib/claude/curriculum";
import { guideCityHref } from "../../lib/claude/curriculum/city-guide";
import { bridges } from "../../lib/claude/curriculum/bridges";
import { cityEvidenceFor, emptyReadiness, readReadiness, readinessKey, updateReadiness } from "../../lib/claude/readiness";
import { benchmarkEvidence } from "../../lib/claude/benchmark";
import { lessonHref, lessonObjectiveFor, lessonObjectives, studyHref } from "../../lib/claude/lessons/paths";
import { cramWindowDays, daysUntilExam, guideForExamDate, inCramWindow, readExamDate, saveExamDate } from "../../lib/exam-date";
import { useStudied } from "./lesson-progress";
import { useRestoreGate } from "../restore-gate";

type View = "overview" | "session" | "review";

function focusDomain(id: string) {
  const panel = document.getElementById(id);
  if (!panel) return false;
  const domain = panel.closest<HTMLDetailsElement>(".academy-domain");
  if (domain) domain.open = true;
  if (panel instanceof HTMLDetailsElement) panel.open = true;
  const target = panel.querySelector("summary") ?? panel;
  if (target === panel) target.tabIndex = -1;
  target.focus({ preventScroll: true });
  panel.scrollIntoView({ block: "start" });
  return true;
}

export function TrackWorkspace({ track, breadcrumbs }: { track: Track; breadcrumbs: ReactNode }) {
  const { ready, user } = useAccount();
  const [view, setView] = useState<View>("overview");
  const [version, setVersion] = useState<ExamVersion>("july-2026");
  const [progress, setProgress] = useState(emptyProgress);
  const [readiness, setReadiness] = useState(emptyReadiness);
  const [readinessError, setReadinessError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [loaded, setLoaded] = useState(false);
  // Mounted from a practice deep link: hold the "Opening practice…" veil until saved progress is restored.
  useRestoreGate("route", loaded);
  const [sessionOnly, setSessionOnly] = useState(false);
  const [assignmentComplete, setAssignmentComplete] = useState(false);
  const [cityRecords, setCityRecords] = useState<PortfolioRecords>({});
  const [timed, setTimed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [discard, setDiscard] = useState(false);
  const [examDate, setExamDate] = useState<string | null>(null);
  const studied = useStudied(track.id);
  const domainFocus = useRef<string | null>(null);
  const latest = useRef(emptyProgress);
  const pending = useRef<Promise<boolean>>(Promise.resolve(true));
  const latestReadiness = useRef(emptyReadiness);
  const pendingReadiness = useRef<Promise<boolean>>(Promise.resolve(true));
  const place = places.find(({ id }) => id === track.place)!;
  const isDispatch = track.id === "architect-foundations";
  const assignment = isCityAssignment(track.id) ? assignments[track.id] : null;
  const bank = practiceBank(track.id, version);
  const cityExposure = cityItemExposure(track, cityRecords);
  const evidence = domainEvidence(track, progress.attempts, cityExposure, version);
  const starter = missionsFor(track.id).find(({ kind }) => kind === "original" || kind === "dispatch")!;
  const portfolio = portfolioEvidence(track, cityRecords, new Set(assignmentComplete ? [starter.id] : []));
  const starterComplete = portfolio.completed.some(({ id }) => id === starter.id);
  const starterCase = caseworkFor(starter.id);
  const december = decemberBlueprint(track);
  const revised = version === decemberVersion;
  const selectedBlueprint = rehearsalBlueprint(track, version);
  const exposure = [...cityExposure.keys(), ...(progress.seen ?? [])];
  const forms = rehearsalForms(track.id, version, progress.attempts, exposure);
  const availableReassessments = new Set(selectedBlueprint.domains.filter(({ id }) =>
    reassessmentItems(track.id, version, id, progress.attempts, exposure).length > 0).map(({ id }) => id));
  const cram = inCramWindow(examDate, now || undefined);
  const city = cityEvidenceFor(track, version, portfolio.applied, portfolio.covered);
  const benchmark = benchmarkEvidence(track, version, readiness, progress.attempts, now, { cram, city });
  const lessonCount = lessonObjectives(track).length;
  const examDays = examDate ? daysUntilExam(examDate, now || undefined) : null;
  const guided = new Set(readiness.guide);
  const passedSkills = (results?: typeof benchmark.practical.capstone) => new Set(results?.results.filter(({ passed }) => passed).flatMap(({ objectives }) => objectives));
  const caseSkills = passedSkills(benchmark.practical.capstone ?? benchmark.practical.firstCapstone);
  const delayedSkills = passedSkills(benchmark.practical.transfer ?? benchmark.practical.firstTransfer);
  const sampledSkills = (stage: "capstone" | "transfer") => new Set(getCapstoneDefinition(track.id, version, stage).criteria
    .flatMap(({ objectives, revisedObjectives }) => revised ? revisedObjectives ?? objectives : objectives));
  const caseSample = sampledSkills("capstone");
  const delayedSample = sampledSkills("transfer");
  const coverage = objectiveCoverage(track, version);
  const cityGuide = isDispatch ? "November" : "July";
  const domainProgress = coverage.map(({ id, title, skills }) => ({
    id, title, objectives: skills.length,
    practiced: skills.filter((skill) => (revised ? guided : portfolio.applied).has(skill.id)).length,
    checked: skills.filter((skill) => revised ? bank.practice.some(({ id, objective }) => objective === skill.id && evidence.firstAnswers.get(id)) : portfolio.demonstrated.has(skill.id)).length,
    practical: skills.filter((skill) => caseSkills.has(skill.id)).length,
    practicalTotal: skills.filter((skill) => caseSample.has(skill.id)).length,
    delayed: skills.filter((skill) => delayedSkills.has(skill.id)).length,
    delayedTotal: skills.filter((skill) => delayedSample.has(skill.id)).length,
  }));
  const objectiveTotal = domainProgress.reduce((sum, entry) => sum + entry.objectives, 0);
  const objectivesPracticed = domainProgress.reduce((sum, entry) => sum + entry.practiced, 0);
  const due = followupDue(progress.attempts, version);
  const transferDue = benchmark.practical.transferDue;
  const followup = progress.attempts.find((attempt) => attempt.mode === "followup" && (attempt.version ?? "july-2026") === version);
  const selectedAttempt = progress.attempts.find(({ id }) => id === reviewId);
  const nextStep = progress.draft ? { label: "Resume your practice session", detail: `${progress.draft.itemIds.length} questions saved`, href: "#practice-controls" }
    : !starterComplete ? { label: "Start your first mission", detail: track.assignment, href: `${cityAssignmentHref(track)}&mission=${starter.id}&guide=${version}` }
    // Experience leads: more cases until about 40% are done (today's work uses the same pacing), then a practice exam.
    // Reading is never assigned; lessons surface from the cases themselves.
    : !benchmark.timed && portfolio.completed.length < Math.ceil(portfolio.missions.length * 0.4) ? { label: "Continue in the city", detail: "Your next mission is waiting", href: cityAssignmentHref(track) }
    : !benchmark.timed ? { label: "Take a practice exam", detail: `${examMinutes} minutes, results by domain`, href: "#rehearsal" }
    : !benchmark.practical.capstone ? { label: "Pass the hands-on lab", detail: "Written answers checked against test cases", href: "#track-practicals" }
    : { label: "Review your weakest domain", detail: "See your results by domain", href: "#readiness" };
  const legacyCompletions = useMemo(() => new Set(assignmentComplete ? [starter.id] : []), [assignmentComplete, starter.id]);
  const today = useTodaysWork(loaded ? track : null, cityRecords, legacyCompletions);
  function startTodayItem(item: TodayItem) {
    const { action } = item;
    if (action.type === "date") {
      document.querySelector<HTMLInputElement>(".academy-exam-date input[type=date]")?.focus();
      return;
    }
    if (action.type === "mission") {
      window.location.assign(`${cityAssignmentHref(track)}&mission=${action.missionId}&guide=${version}`);
      return;
    }
    const target = new URL(action.href, window.location.href);
    if (target.pathname === window.location.pathname && target.hash && target.search === window.location.search) {
      document.querySelector(target.hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
      (document.querySelector(target.hash) as HTMLElement | null)?.focus({ preventScroll: true });
    } else window.location.assign(target.href);
  }
  const practiceCount = Math.min(bank.practice.length, 12);
  const pacing = Math.ceil(practiceCount * examMinutes / selectedBlueprint.count);
  const focusHeading = useRef(false);

  useEffect(() => {
    if (!ready) return;
    const params = new URLSearchParams(window.location.search);
    const linkedGuide = december && params.get("guide") === decemberVersion ? decemberVersion : params.get("guide") === "july-2026" ? "july-2026" : undefined;
    function restore() {
      const value = readProgress(track) ?? emptyProgress;
      latest.current = value;
      setProgress(value);
      const savedReadiness = readReadiness(track) ?? emptyReadiness;
      latestReadiness.current = savedReadiness;
      setReadiness(savedReadiness);
      const pinned = new URLSearchParams(window.location.search).get("guide");
      if (linkedGuide && pinned === linkedGuide) setVersion(linkedGuide);
      else if (december && savedReadiness.version) setVersion(savedReadiness.version);
      setCityRecords(readPortfolio(user ? null : undefined));
      if (track.id === "architect-foundations") {
        const dispatch = readDispatch();
        setAssignmentComplete(!!dispatch && meetsDispatchGoal(runShift(dispatch.contract, dispatch.routes)));
      } else {
        setAssignmentComplete(!!readCityAssignment(track));
      }
      setNow(Date.now());
    }
    restore();
    const savedDate = readExamDate(track.id);
    setExamDate(savedDate);
    if (!linkedGuide && !latestReadiness.current.version) {
      // Without a saved choice, follow the exam date. With no date either, use the December guide:
      // it governs every exam from December 7 and the exam-date card asks earlier candidates to switch.
      const fromDate = savedDate ? guideForExamDate(savedDate) : decemberVersion;
      setVersion(december && (latest.current.draft?.version === decemberVersion || fromDate === decemberVersion) ? decemberVersion : "july-2026");
    }
    setLoaded(true);
    if (window.location.hash === "#assignment") {
      window.location.replace(cityAssignmentHref(track));
    }
    const linkedObjective = params.get("objective");
    const linkedDomain = Number(params.get("domain"));
    if (linkedObjective && /^\d+\.\d+$/.test(linkedObjective)) {
      requestAnimationFrame(() => focusDomain((linkedGuide === decemberVersion ? "guide-case-" : "july-skill-") + linkedObjective));
    } else if (linkedDomain > 0) {
      requestAnimationFrame(() => focusDomain((linkedGuide === decemberVersion ? "december" : "july") + "-domain-" + linkedDomain));
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
    if (!loaded) return;
    const hash = window.location.hash.slice(1);
    if (!hash || hash === "assignment") return;
    const frame = requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView());
    return () => cancelAnimationFrame(frame);
  }, [loaded, version]);

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
    const url = new URL(window.location.href);
    url.searchParams.set("practice", "1");
    url.searchParams.delete("guide");
    url.searchParams.delete("domain");
    url.searchParams.delete("objective");
    window.history.replaceState(window.history.state, "", url);
    void saveReadiness({ type: "version", version: examVersion });
  }

  function chooseExamDate(value: string | null) {
    setExamDate(value);
    saveExamDate(track.id, value);
    setNow(Date.now());
    if (value && december) {
      const guide = guideForExamDate(value);
      if (guide !== version) selectVersion(guide);
    }
  }

  function showReview(id: string) {
    setReviewId(id);
    navigate("review");
  }

  async function start(mode: PracticeMode, domain: number | null = null, form?: RehearsalForm, objective?: string) {
    if (busy || !loaded) return;
    if (latest.current.draft) {
      setError("Resume or discard the saved session before starting another.");
      document.getElementById("practice-start")?.focus();
      document.getElementById("practice-controls")?.scrollIntoView({ block: "center" });
      return;
    }
    setBusy(true);
    const session = createSession(track, mode, domain, mode === "mixed" && timed, latest.current.attempts, Date.now(), [...cityExposure.keys(), ...(latest.current.seen ?? [])], version, form, objective);
    if (!session.itemIds.length) {
      setError("There is no unused set available for this selection. Review a completed attempt.");
      setBusy(false);
      document.getElementById("practice-controls")?.scrollIntoView({ block: "center" });
      return;
    }
    if (await save({ type: "start", draft: session })) {
      recordPracticeMilestone("started", track.id, "academy");
      navigate("session");
    }
    setBusy(false);
  }

  async function submit() {
    if (!progress.draft || busy) return;
    setBusy(true);
    const id = progress.draft.id;
    if (await save({ type: "submit", id }) && latest.current.attempts.some((entry) => entry.id === id)) {
      recordPracticeMilestone("completed", track.id, "academy");
      setNow(Date.now());
      showReview(id);
    }
    setBusy(false);
  }

  function practiceDomain(domain: number, objective?: string) {
    const reviewVersion = selectedAttempt?.version === decemberVersion ? decemberVersion : "july-2026";
    setVersion(reviewVersion);
    domainFocus.current = objective ? (reviewVersion === decemberVersion ? "guide-case-" : "july-skill-") + objective
      : (reviewVersion === decemberVersion ? "december" : "july") + "-domain-" + domain;
    navigate("overview");
  }

  if (view === "session" && progress.draft) {
    return <PracticeSession track={track} session={progress.draft} error={error} busy={busy} onPresent={present}
      onMove={(id, index) => save({ type: "move", id, index })} onChoose={(id, itemId, value) => save({ type: "choose", id, itemId, value })} onSubmit={() => void submit()} onExit={() => navigate("overview")} />;
  }
  if (view === "review" && selectedAttempt) {
    return <PracticeReview track={track} attempt={selectedAttempt} due={followupDue(progress.attempts, selectedAttempt.version ?? "july-2026")} onBack={() => navigate("overview")} onDomain={practiceDomain} />;
  }

  return (
    <main id="academy-main" tabIndex={-1} className="academy-width academy-workspace academy-study-workspace">
      {breadcrumbs}
      <section className="academy-track-hero" data-track={track.id}>
        <div>
          <div className="academy-title-label"><span className="academy-code">{track.code}</span></div>
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
        <Link className="academy-external" href={trackHref(track)}>Study guide and sample questions</Link>
      </div>
      {loaded && today && today.items.length > 0 && <div className="academy-today"><TodayWork view={today} onAction={startTodayItem} /></div>}
      {loaded && !(today && today.items.length > 0) && <section className="academy-panel academy-assignment-card academy-next-step" aria-labelledby="next-step-title">
        <div>
          <h2 id="next-step-title">What to do next</h2>
          <p><strong>{nextStep.label}</strong>. {nextStep.detail}.</p>
        </div>
        {nextStep.href.startsWith("#")
          ? <a className="academy-button primary" href={nextStep.href}>{nextStep.label} <ArrowRight size={16} aria-hidden="true" /></a>
          : <Link className="academy-button primary" href={nextStep.href}>{nextStep.label} <ArrowRight size={16} aria-hidden="true" /></Link>}
      </section>}
      <section className="academy-panel academy-exam-date" aria-labelledby="exam-date-title">
        <div className="academy-section-heading"><h2 id="exam-date-title">Your exam date</h2></div>
        <div className="academy-exam-date-row">
          <label>Exam date <input type="date" value={examDate ?? ""} onChange={(event) => chooseExamDate(event.target.value || null)} /></label>
          {december && <fieldset className="academy-exam-version">
            <legend>Exam guide</legend>
            <label><input type="radio" name="exam-version" checked={version === "july-2026"} onChange={() => selectVersion("july-2026")} />Before December 7</label>
            <label><input type="radio" name="exam-version" checked={version === decemberVersion} onChange={() => selectVersion(decemberVersion)} />December 7 or later</label>
          </fieldset>}
        </div>
        <p>{examDays === null
          ? `Set your date to load the right guide${december ? " (the December 7 revision changed this exam’s domains and weights)" : ""} and to get a plan that fits the time you have.`
          : examDays < 0 ? "This date has passed. Set your next attempt to update the plan."
          : `${examDays === 0 ? "Today" : `${examDays} ${examDays === 1 ? "day" : "days"} away`} · ${examGuideLabel(track, version)}.`}</p>
        {cram && <p className="academy-positive" role="status"><Check size={16} aria-hidden="true" /> Your exam is under {cramWindowDays} days away, so the short-runway plan applies: a second practice exam you haven’t seen replaces the 7-day review lab. Today’s work puts the missions for your weakest areas first; each opens its lesson when you need it.</p>}
      </section>
      <section className="academy-panel academy-assignment-card academy-study-card" aria-labelledby="study-guide-title">
        <div>
          <h2 id="study-guide-title">Study guide: {lessonCount} lessons</h2>
          <p>One lesson per exam objective, with the configuration, API and workflow details the exam asks about. {studied.size}/{lessonCount} studied.</p>
        </div>
        <Link className="academy-button primary" href={studyHref(track)}>{studied.size ? "Continue studying" : "Open the study guide"} <ArrowRight size={16} aria-hidden="true" /></Link>
      </section>
      <section className="academy-panel academy-assignment-card academy-first-assignment" id="city-cases" tabIndex={-1} aria-labelledby="track-assignment">
        <div>
          <p className="academy-kicker">{place.name}</p>
          <h2 id="track-assignment">{track.assignment}</h2>
          <p>{cityRecords[starter.id]?.casework && starterCase ? starterCase.retest.done : assignmentComplete && assignment ? assignment.impact : bridges[track.id].mission}</p>
          {starterComplete && <p className="academy-positive"><Check size={16} aria-hidden="true" /> First mission done</p>}
        </div>
        <Link className="academy-button primary" href={starterComplete ? cityAssignmentHref(track) : `${cityAssignmentHref(track)}&mission=${starter.id}&guide=${version}`}>
          {starterComplete ? "Continue in the city" : "Open your first mission"} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>
      <nav className="academy-pathway-links" aria-label="Study sections">
        <Link href={studyHref(track)}>Lessons</Link>
        <Link href={cityAssignmentHref(track)}>City</Link>
        <a href="#practice-controls">{progress.draft ? "Resume practice" : "Practice"}</a>
        <a href="#rehearsal">Exams</a>
      </nav>
      {readinessError && <p className="academy-error" role="alert">{readinessError}</p>}
      <div className="academy-track-layout">
        <div className="academy-main-column">
          {loaded && <EntryBridge key={user?.id ?? "guest"} track={track} version={version} saved={readiness.bridge}
            onSave={(choices) => saveReadiness({ type: "bridge", choices })}
            onSkill={(objective) => focusDomain((revised ? "guide-case-" : "july-skill-") + objective)} />}
          <section className="academy-panel academy-pathway-progress" aria-labelledby="overall-progress-heading">
            <h2 id="overall-progress-heading">Progress</h2>
            {!user && loaded && !sessionOnly && <p>Signed-out progress is saved in this browser.</p>}
            <dl>
              <div><dt>Lessons studied</dt><dd>{studied.size}/{lessonCount}</dd></div>
              <div><dt>City missions done</dt><dd>{portfolio.completed.length}/{portfolio.missions.length}</dd></div>
              <div><dt>{revised ? "Objectives practiced (December guide)" : `Objectives practiced (${cityGuide} guide)`}</dt><dd>{objectivesPracticed}/{objectiveTotal}</dd></div>
              {portfolio.guided.size > 0 && <div><dt>Needed a hint (redo to count)</dt><dd>{portfolio.guided.size}</dd></div>}
              <div><dt>Right first time ({cityGuide} guide)</dt><dd>{portfolio.demonstrated.size}</dd></div>
              <div><dt>Hands-on labs passed</dt><dd>{Number(!!benchmark.practical.capstone) + Number(!!benchmark.practical.transfer)}/2</dd></div>
            </dl>
          </section>
          <section className="academy-panel academy-start-panel" id="practice-controls" tabIndex={-1} aria-labelledby="practice-title">
            <div className="academy-section-heading">
              <h2 id="practice-title">{progress.draft ? "Resume practice" : "Mixed practice"}</h2>
            </div>
            {progress.draft ? (
              <>
                <p>{modeLabel(track, progress.draft)}, {progress.draft.itemIds.length} questions{progress.draft.mode === "assessment" && ` (${examGuideLabel(track, progress.draft.version)})`}</p>
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
                <p>{practiceCount} questions across {selectedBlueprint.domains.length} domains in your selected guide. Review your answers and sources after submitting.</p>
                <div className="academy-actions">
                  <button id="practice-start" className="academy-button primary" disabled={busy || !loaded} onClick={() => void start("mixed")}>Start mixed practice <ArrowRight size={16} aria-hidden="true" /></button>
                  <label className="academy-timed"><input type="checkbox" checked={timed} onChange={(event) => setTimed(event.target.checked)} /> Timed · {pacing} min</label>
                </div>
              </>
            )}
            {error && <p className="academy-error" role="alert">{error}</p>}
            {sessionOnly && <p className="academy-error" role="status">Browser storage is unavailable. This progress lasts until you leave the page.</p>}
          </section>
          <section className="academy-panel academy-rehearsal-forms" id="rehearsal" tabIndex={-1} aria-labelledby="rehearsal-title">
            <h2 id="rehearsal-title">Practice exams</h2>
            <p>{examMinutes} minutes, original questions in the exam guide’s format, results by domain. Keep one exam unseen for your final check.</p>
            {revised && <p>Each form has 60 scored and 10 unscored questions. See feedback for every question after submitting.</p>}
            {forms.map(({ form, items, exposed, completed }) => <div key={form} className="academy-rehearsal">
              <div>
                <h3>{rehearsalFormLabel(form)}</h3>
                <p>{items.length > 0 ? <>{items.length} questions, {exposed ? `${exposed} already seen` : "all new to you"}{completed && ". Completed"}</> : "No unused full set available for this guide."}</p>
              </div>
              <button type="button" className="academy-button primary" disabled={busy || !loaded || !!progress.draft || !items.length}
                onClick={() => void start("assessment", null, form)}>{completed ? "Repeat" : "Start"} {rehearsalFormLabel(form).toLowerCase()} <ArrowRight size={16} aria-hidden="true" /></button>
            </div>)}
          </section>
          <ReadinessPanel evidence={benchmark} domains={domainProgress} revised={revised} now={now}
            onDomain={(id) => focusDomain((revised ? "december" : "july") + "-domain-" + id)}
            availableReassessments={availableReassessments} reassessmentDisabled={!!progress.draft || !loaded || busy}
            onReassess={(id) => { void start("reassessment", id); }} />
          {revised && <>
            <GuideSkills key={`${track.id}:${user?.id ?? "guest"}`} track={track} practiced={guided}
              onPractice={(objective) => saveReadiness({ type: "guide", objective })} onTarget={(id, objective) => { void start("domain", id, undefined, objective); }} />
            <DecemberWorkshop track={track.id} completed={readiness.workshop} onComplete={() => void saveReadiness({ type: "workshop" })} />
          </>}
          {loaded && <CapstoneWorkspace key={`${version}:${user?.id ?? "guest"}`} track={track} version={version} attempts={readiness.capstones}
            onSubmit={(attempt) => saveReadiness({ type: "submission", attempt })} />}
          <section className="academy-domain-section" aria-labelledby="domain-title">
            <div className="academy-section-heading">
              <h2 id="domain-title">Question practice by domain</h2>
              <span>{evidence.reviewed.size} / {bank.practice.length} questions practiced</span>
            </div>
            <div className="academy-domain-list">
              {coverage.map((domain) => {
                const items = bank.practice.filter((entry) => itemDomain(entry) === domain.id);
                const available = new Set(items.map(({ objective }) => objective));
                const practiced = evidence.firstObjectives.get(domain.id) ?? new Set();
                const count = evidence.domainCounts.get(domain.id) ?? 0;
                return (
                  <details key={domain.id} className="academy-domain" id={(revised ? "question" : "july") + "-domain-" + domain.id}>
                    <summary><span><strong>{domain.title}</strong><small>{items.length} {items.length === 1 ? "question" : "questions"} on {available.size} of {domain.objectives.length} objectives{count ? `, ${evidence.domainScores.get(domain.id) ?? 0}/${count} right first time` : ""}</small></span><span className="academy-weight">{domain.weight}%</span><ChevronDown size={17} aria-hidden="true" /></summary>
                    <div className="academy-domain-body">
                      {!revised && <p>{domain.objectives.filter((_, i) => portfolio.applied.has(`${domain.id}.${i + 1}`)).length}/{domain.objectives.length} practiced in the city,
                        {" "}{domain.objectives.filter((_, i) => portfolio.demonstrated.has(`${domain.id}.${i + 1}`)).length}/{domain.objectives.length} right first time</p>}
                      <ul className="academy-objectives">
                        {domain.skills.map(({ id: code, title: name, missions }) => (
                          <li key={code} id={(revised ? "question-skill-" : "july-skill-") + code} className="academy-mapped-skill">
                            <div><span>{code} · {name}</span>
                              <div className="academy-mission-links">{missions.map((mission) => <Link key={mission.id} href={revised ? guideCityHref(track.id, mission.id, code) : `${cityAssignmentHref(track)}&mission=${mission.id}&guide=${version}`}>{mission.title}</Link>)}</div>
                            </div>
                            <div className="academy-skill-status">
                              {(() => {
                                const lesson = lessonObjectiveFor(track, version, code);
                                return lesson && <Link className="academy-button text" href={lessonHref(track, lesson)} aria-label={`Lesson for ${name}`}>{studied.has(lesson) ? "Lesson ✓" : "Lesson"}</Link>;
                              })()}
                              <span>{!revised && portfolio.demonstrated.has(code) ? "Right first time" : practiced.has(code) ? "Practiced" : !revised && portfolio.applied.has(code) ? "Practiced in the city" : "Available"}</span>
                              {available.has(code) && <button type="button" className="academy-button text" disabled={busy || !loaded} aria-label={"Practice " + name}
                                onClick={() => void start("domain", domain.id, undefined, code)}>Practice</button>}
                            </div>
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
        <aside className="academy-sidebar" aria-label="7-day review and official resources">
          <section className="academy-panel" id="practice-followup">
            <div className="academy-section-heading"><h2>7-day review</h2></div>
            <p>{followup ? "Your 7-day review is saved." : due === null ? "New questions on the same skills open 7 days after mixed practice." : due > now ? `Opens ${dueLabel(due)}.` : `${bank.followup.length} new questions are ready.`}</p>
            {followup
              ? <button className="academy-button secondary" onClick={() => showReview(followup.id)}>See 7-day review results <ArrowRight size={16} aria-hidden="true" /></button>
              : due !== null && due <= now && <button className="academy-button secondary" disabled={busy} onClick={() => void start("followup")}>Start 7-day review <ArrowRight size={16} aria-hidden="true" /></button>}
          </section>
          {!!progress.attempts.length && (
            <section className="academy-panel academy-history">
              <h2>Practice history</h2>
              <ul>
                {[...progress.attempts].reverse().map((attempt) => {
                  const items = sessionItems(track, attempt).filter((item) => !item.pilot);
                  return <li key={attempt.id}><button onClick={() => showReview(attempt.id)}>
                    <span><strong>{modeLabel(track, attempt)} · {attempt.snapshot?.label ?? examGuideLabel(track, attempt.version)}</strong><small>{dateFormat.format(attempt.submittedAt)}</small></span>
                    <span>{score(items, attempt.answers)}/{items.length} <ArrowRight size={15} aria-hidden="true" /></span>
                  </button></li>;
                })}
              </ul>
            </section>
          )}
          <section className="academy-panel academy-official">
            <div className="academy-section-heading"><h2>Official resources</h2></div>
            <ExternalLink href={track.prep}>Anthropic prep courses</ExternalLink>
            <ExternalLink href={examRegistration(track)}>Exam registration</ExternalLink>
            <p>Registration requires a Claude Partner Network account. {user ? "Practice progress syncs to your CertCity account." : "Guest practice progress is stored on this device."}</p>
          </section>
          <nav className="academy-panel academy-related" aria-labelledby="related-pathways">
            <h2 id="related-pathways">Other Claude study paths</h2>
            <ul>
              {tracks.filter(({ id }) => id !== track.id).map((other) => <li key={other.id}>
                <Link href={trackHref(other)} prefetch={false}>{other.role} {other.level} practice</Link>
              </li>)}
            </ul>
          </nav>
        </aside>
      </div>
    </main>
  );
}
