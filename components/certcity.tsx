"use client";

import {
  ArrowLeft, ArrowRight, ArrowUpRight, ChevronDown, ChevronRight,
  ClipboardList, GraduationCap, Map, MapPin, MessagesSquare, ScanLine, X, Wrench,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { dispatchName, places, stations } from "../lib/world";
import { defaultDistrict, districts } from "../lib/scene/districts";
import type { DistrictId } from "../lib/scene/districts";
import type { PlaceId, StationId } from "../lib/world";
import { baselineShift, dispatchProgressKey, initialRoutes, meetsDispatchGoal, readDispatch, runShift, saveDispatch } from "../lib/shift";
import type { Condition, Contract, DispatchPolicy, Route, Routes, ShiftResult } from "../lib/shift";
import { WorldScene } from "./world-scene";
import { DispatchBrief, focusTicketRule, ShiftSummary, SystemBoard, SystemControls } from "./system-view";
import { ExamLens } from "./dialogs";
import { CertificationDialog, ModuleProgressButton, useCertificationProgress } from "./certification-dialog";
import { dispatchPreparationSteps, followupAt } from "../lib/certification-progress";
import type { CertificationPage } from "./certification-dialog";
import { CityImpact } from "./city-impact";
import { tracks } from "../lib/claude/blueprints";
import type { Track } from "../lib/claude/blueprints";
import { assignments as cityCases, isCityAssignment } from "../lib/claude/assignments";
import type { CityAssignmentId } from "../lib/claude/assignments";
import { activeAssignmentKey, readActiveAssignment, readCityAssignment, saveActiveAssignment, saveCityAssignment } from "../lib/claude/city-progress";
import { progressScope, subscribeToProgress } from "../lib/progress-storage";
import { openDispatchAttempt, saveDispatchRun } from "../lib/supabase/dispatch";
import type { DispatchCommand } from "../lib/supabase/dispatch";
import { AccountButton, useAccount } from "./account";
import { CityAssignmentDialog } from "./academy/assignment";
import { DispatchConversation, PlaceConversation } from "./city-visits";
import { CityCertificationDialog, MissionJournal } from "./academy/city-certifications";
import { MissionWorkbench } from "./academy/mission-workbench";
import { BuildingAssignmentDialog } from "./academy/building-assignment";
import type { BuildingStation } from "./academy/building-assignment";
import { lensForMission } from "../lib/claude/assignment-lens";
import { assignmentOutcome, assignmentStations, hasAssignmentWork } from "../lib/claude/assignment-work";
import { missingExpertise, missionCompleted, missionPreparationSteps, missionsFor, readPortfolio, recordMissionLens, unmetMissions } from "../lib/claude/pathway";
import type { PortfolioRecords } from "../lib/claude/pathway";
import { replayMission } from "../lib/claude/missions";
import type { Mission } from "../lib/claude/missions";
import { missionExperiences } from "../lib/claude/mission-experiences";
import { citySigns } from "../lib/city-signs";
import { caseworkFor } from "../lib/claude/cases";
import { workLayout } from "../lib/claude/cases/layouts";
import { roomCaseOutcome, roomFirstAction } from "../lib/claude/cases/presentation";

type View = "city" | "depot" | "mission";

const cityMarkers = places.map((place) => ({
  ...place,
  name: place.shortName,

}));
const libraryTrack = tracks.find(({ id }) => id === "architect-foundations")!;
const referenceDesk = missionsFor(libraryTrack.id).find(({ id }) => id === "library-search")!;
const nolanMarker = { id: "olive-library", label: "Talk to Nolan", name: "Nolan" } as const;

function canEnterMission(mission: Mission, records: PortfolioRecords, legacy: ReadonlySet<string>) {
  return missionCompleted(mission, records, legacy) ||
    (!unmetMissions(mission, records, legacy).length && !missingExpertise(mission, records).length);
}

function replaceMissionLocation(mission?: Mission) {
  const url = new URL(window.location.href);
  if (mission) {
    url.searchParams.set("pathway", mission.track);
    url.searchParams.set("mission", mission.id);
  } else {
    if (!url.searchParams.has("mission")) return;
    url.searchParams.delete("mission");
    url.searchParams.delete("pathway");
  }
  url.searchParams.delete("assignment");
  window.history.replaceState(window.history.state, "", url);
}

function CityInspector({ selected, district, onSelect, onMission, onTalk, missions, legacy, records }: {
  selected: PlaceId | null;
  district: DistrictId;
  onSelect: (id: PlaceId | null) => void;
  onMission: (mission: Mission) => void;
  missions: readonly Mission[];
  legacy: ReadonlySet<string>;
  records: PortfolioRecords;
  onTalk: (place: PlaceId) => void;
}) {
  const place = places.find(({ id }) => id === selected);

  const local = missions.filter((mission) => mission.place === selected);

  return (
    <aside className="inspector city-inspector" aria-labelledby="places-heading">
      <header className="inspector-header">
        <div className="inspector-heading">
          {place ? (
            <button className="icon-button inspector-back" type="button" aria-label="Back to places"
              onClick={() => onSelect(null)}>
              <ArrowLeft size={19} aria-hidden="true" />
            </button>
          ) : <MapPin size={19} aria-hidden="true" />}
          <h2 id="places-heading" tabIndex={-1}>{place?.name ?? districts.find(({ id }) => id === district)?.name}</h2>
        </div>
      </header>

      {place ? (
        <div className="inspector-body place-detail" aria-live="polite">
          <div className="person">
            <span className="place-icon person-icon" data-color={place.color}>
              <place.icon size={22} aria-hidden="true" />
            </span>
            <div>
              <h3>{place.person}</h3>
              <p>{place.role}</p>
            </div>
          </div>
          <p className="body-copy">{place.activity}</p>
          {"address" in place && <p className="place-address"><MapPin size={14} aria-hidden="true" />{place.address}</p>}
          {place.id === "olive-library" && (
            <button className="button button-outline" type="button" onClick={() => onTalk(place.id)}>
              <MessagesSquare size={17} aria-hidden="true" /> Talk to Nolan
            </button>
          )}
          {local.map((mission) => {
            const done = missionCompleted(mission, records, legacy);
            const unmet = unmetMissions(mission, records, legacy);
            const missing = missingExpertise(mission, records);
            const locked = !done && (unmet.length || missing.length);
            return <div className={locked ? "example-card" : "assignment-card"} key={mission.id}>
              <span className="small-label">{done ? "Mission complete" : locked ? "Later mission" : "Available mission"}</span>
              <h3>{mission.title}</h3>
              <p>{mission.brief}</p>
              {locked ? <p>{unmet.length ? `Complete ${unmet.map(({ title }) => title).join(" and ")} first.` : `Check or review objectives ${missing.join(", ")} first.`}</p> :
                <button className="button button-primary" type="button" onClick={() => onMission(mission)}>
                  <MessagesSquare size={17} aria-hidden="true" /> {done ? "Re-enter building" : "Enter building"} <ArrowRight size={17} aria-hidden="true" />
                </button>}
            </div>;
          })}
          {!local.length && <div className="example-card">
            <p>{place.example}</p>
            {place.id !== "olive-library" && <button className="button button-outline" type="button" onClick={() => onTalk(place.id)}>
              <MessagesSquare size={17} aria-hidden="true" /> Talk to {place.person.split(" ")[0]}
            </button>}
          </div>}
        </div>
      ) : (
        <>
          <ul className="places-list">
            {places.filter((site) => site.district === district).map(({ id, name, role, color, icon: Icon }) => (
              <li key={id}>
                <button className="place-row" type="button" onClick={() => onSelect(id)}>
                  <span className="place-icon" data-color={color}><Icon size={18} aria-hidden="true" /></span>
                  <span className="place-row-copy"><strong>{name}</strong><span>{role}</span></span>
                  <ChevronRight size={16} className="row-chevron" aria-hidden="true" />
                </button>
              </li>
            ))}
            {citySigns.flatMap(({ kind, name, href, placements }) => placements.filter((placement) => placement.district === district).map(({ location }) => (
              <li key={location}>
                <a className="place-row" href={href} target="_blank" rel="noopener noreferrer">
                  <span className="place-icon"><ArrowUpRight size={18} aria-hidden="true" /></span>
                  <span className="place-row-copy">
                    <strong>{name}</strong>
                    <span>{kind === "billboard" ? `Billboard at ${location}` : location}</span>
                  </span>
                </a>
              </li>
            )))}
          </ul>

        </>
      )}
    </aside>
  );
}

function DepotInspector({ selected, onSelect, onSystem, onTalk, result }: {
  selected: StationId;
  result: ShiftResult | null;
  onSelect: (id: StationId) => void;
  onSystem: () => void;
  onTalk: () => void;
}) {
  const station = stations.find(({ id }) => id === selected) ?? stations[0];

  return (
    <aside className="inspector" aria-labelledby="depot-heading">
      <header className="inspector-header">
        <div className="inspector-heading">
          <MessagesSquare size={19} aria-hidden="true" />
          <h2 id="depot-heading">Inside the depot</h2>
        </div>
      </header>
      <div className="inspector-body">
        <div className="station-select" role="group" aria-label="Talk to a stakeholder">
          {stations.map(({ id, person }) => (
            <button className="station-button" key={id} type="button" aria-pressed={station.id === id}
              onClick={() => onSelect(id)}>
              {person.split(" ")[0]}
            </button>
          ))}
        </div>
        <div className="person">
          <span className="place-icon person-icon" data-color={station.color}>
            <station.icon size={22} aria-hidden="true" />
          </span>
          <div><h3>{station.person}</h3><p>{station.role}</p></div>
        </div>
        <blockquote className="stakeholder-quote">{station.quote}</blockquote>
        <div className="evidence-card">
          <span className="small-label">Case evidence</span>
          <p>{station.evidence}</p>
        </div>
        {result && station.id === "support" && (
          <div className="evidence-card" role="status">
            <span className="small-label">Follow-up workload</span>
            <p>{result.staffHours} staff hours per simulated week</p>
          </div>
        )}
        <button className="button button-primary" type="button" onClick={onTalk}>
          <MessagesSquare size={17} aria-hidden="true" /> Talk to Nia <ArrowRight size={16} aria-hidden="true" />
        </button>
        <button className="button button-text" type="button" onClick={onSystem}>
          <ScanLine size={16} aria-hidden="true" /> Open order lookup
        </button>
      </div>
    </aside>
  );
}

export function CertCity() {
  const { ready, user, sync } = useAccount();
  const [view, setView] = useState<View>("city");
  const [selectedPlace, setSelectedPlace] = useState<PlaceId | null>(null);
  const [districtVisit, setDistrictVisit] = useState(0);
  const [station, setStation] = useState<StationId>("support");
  const [inspecting, setInspecting] = useState(false);
  const [district, setDistrict] = useState<DistrictId>(defaultDistrict);
  const [districtMenu, setDistrictMenu] = useState(false);
  const [contract, setContract] = useState<Contract>("baseline");
  const [routes, setRoutes] = useState<Routes>(initialRoutes);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<ShiftResult | null>(null);
  const [savedPolicy, setSavedPolicy] = useState<DispatchPolicy | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unavailable" | null>(null);
  const [shiftError, setShiftError] = useState<string | null>(null);
  const dispatchCommand = useRef<DispatchCommand | null>(null);
  const dispatchAttempt = useRef<ReturnType<typeof openDispatchAttempt> | null>(null);
  const savingShift = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [cityAssignment, setCityAssignment] = useState<Track | null>(null);
  const [activeMission, setActiveMission] = useState<Mission | null>(null);
  const [records, setRecords] = useState<PortfolioRecords>({});
  const [journalProgress, setJournalProgress] = useState(false);
  const [requestedMission, setRequestedMission] = useState<string | null>(null);
  const [openPicker, setOpenPicker] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [placeVisit, setPlaceVisit] = useState<PlaceId | null>(null);
  const [dispatchVisit, setDispatchVisit] = useState(false);
  const [taskConversationOpen, setTaskConversationOpen] = useState(false);
  const [buildingStation, setBuildingStation] = useState<BuildingStation | null>(null);
  const [completedAssignments, setCompletedAssignments] = useState<Partial<Record<CityAssignmentId, boolean>>>({});
  const [selectedCertification, setSelectedCertification] = useState<Track | null>(null);
  const [certificationPage, setCertificationPage] = useState<CertificationPage | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const journal = useRef<HTMLDialogElement>(null);
  const missionDialog = useRef<HTMLDialogElement>(null);
  const certificationMenu = useRef<HTMLDialogElement>(null);
  const buildingDialog = useRef<HTMLDialogElement>(null);
  const stationOpener = useRef<HTMLButtonElement | null>(null);
  const restoreStationFocus = useRef(false);
  const savedBuildingOutcome = useRef(false);
  const openPriorReplay = useRef(false);
  const savedLegacyOutcome = useRef(false);
  const fromLibrarySteps = useRef(false);
  const cityAssignmentDialog = useRef<HTMLDialogElement>(null);
  const visitDialog = useRef<HTMLDialogElement>(null);
  const dispatchDialog = useRef<HTMLDialogElement>(null);
  const examLens = useRef<HTMLDialogElement>(null);
  const workflow = useRef<HTMLDialogElement>(null);
  const certificationDialog = useRef<HTMLDialogElement>(null);
  const impactDialog = useRef<HTMLDialogElement>(null);
  const savedResult = savedPolicy && runShift(savedPolicy.contract, savedPolicy.routes);
  const effectiveResult = result ?? savedResult;
  const shiftComplete = !!savedResult && meetsDispatchGoal(savedResult);
  const certification = useCertificationProgress(shiftComplete);
  const committedDispatchCheck = certification.committedDispatchCheck;
  const activeCase = cityAssignment && isCityAssignment(cityAssignment.id) ? cityCases[cityAssignment.id] : null;
  const activeMissionPlaceId = activeMission?.place ?? cityAssignment?.place;
  const activePlace = activeMissionPlaceId ? places.find(({ id }) => id === activeMissionPlaceId) : null;
  const interiorMission = activeMission ?? (cityAssignment ? missionsFor(cityAssignment.id).find(({ kind }) => kind === "original") ?? null : null);
  const certificationMission = view === "mission" ? interiorMission : null;
  const lensQuestion = certificationMission ? lensForMission(certificationMission) : undefined;
  const interior = interiorMission ? missionExperiences[interiorMission.id] : undefined;
  const workId = activeMission?.kind === "workbench" && hasAssignmentWork(activeMission.id) ? activeMission.id : undefined;
  const exercise = interiorMission ? caseworkFor(interiorMission.id) : undefined;
  const caseRecord = interiorMission ? records[interiorMission.id] : undefined;
  const localOutcome = interiorMission && exercise && caseRecord?.casework ? roomCaseOutcome(interiorMission.id, exercise, caseRecord.casework)
    : workId && records[workId]?.work ? assignmentOutcome(records[workId].work) : null;
  const workLabel = exercise?.station ?? (workId ? assignmentStations[workId] : "Work area");
  const buildingMarkers = interiorMission && interior ? [
    { id: "stakeholder-0" as const, name: interior.interviews[0].name, icon: MessagesSquare, color: "blue" },
    { id: "stakeholder-1" as const, name: interior.interviews[1].name, icon: MessagesSquare, color: "blue" },
    { id: "evidence" as const, name: "Case file", icon: ClipboardList, color: "blue" },
    { id: "work" as const, name: workLabel, icon: Wrench, color: "gold", assignment: true },
  ] : [];
  const activeSave = cityAssignment ? readCityAssignment(cityAssignment) : null;
  const visitorPlace = placeVisit ? places.find(({ id }) => id === placeVisit) : null;
  const legacy = new Set([
    ...(shiftComplete ? ["dispatch-lookup"] : []),
    ...(completedAssignments["associate-foundations"] ? ["enrollment-replies"] : []),
    ...(completedAssignments["developer-foundations"] ? ["supplier-invoices"] : []),
    ...(completedAssignments["architect-professional"] ? ["support-pilot"] : []),
  ]);
  const missions = selectedCertification ? missionsFor(selectedCertification.id) : [];
  const missionRecord = certificationMission ? records[certificationMission.id] : undefined;
  const missionComplete = !!certificationMission && missionCompleted(certificationMission, records, legacy);
  const moduleSteps = certificationMission ? missionPreparationSteps(missionComplete, missionRecord)
    : view === "depot" ? dispatchPreparationSteps(certification.progress, shiftComplete) : null;
  const moduleProgress = moduleSteps && <ModuleProgressButton completed={moduleSteps} onOpen={() => openCertification("pathway")} />;
  const available = missions.filter((mission) => !unmetMissions(mission, records, legacy).length && !missingExpertise(mission, records).length && !missionCompleted(mission, records, legacy));
  const libraryComplete = missionCompleted(referenceDesk, records, legacy);
  const markers = cityMarkers.map((place) => ({ ...place, assignment: missions.some((mission) =>
    mission.place === place.id && (missionCompleted(mission, records, legacy) || (!unmetMissions(mission, records, legacy).length && !missingExpertise(mission, records).length))) }));
  const cityStatuses = Object.fromEntries(places.flatMap((place) => {
    const count = available.filter(({ place: id }) => id === place.id).length;
    return count ? [[place.id, `${count} ${count === 1 ? "mission" : "missions"} available`]] : missions.some((mission) =>
      mission.place === place.id && missionCompleted(mission, records, legacy)) ? [[place.id, "Assignment complete"]] : [];
  }));
  const savedCityOutcomes = [
    ...tracks.flatMap((track) =>
      isCityAssignment(track.id) && completedAssignments[track.id] &&
        !missionsFor(track.id).some(({ id, kind }) => kind === "original" && records[id]?.casework)
        ? [{ place: places.find(({ id }) => id === track.place)!.name, outcome: cityCases[track.id].impact }]
        : []),
    ...tracks.flatMap(({ id }) => missionsFor(id)).filter((mission) => missionCompleted(mission, records, new Set())).flatMap((mission) => {
      const exercise = caseworkFor(mission.id);
      const record = records[mission.id];
      if (exercise && record?.casework) {
        return [{ place: places.find(({ id }) => id === mission.place)!.name, title: mission.title,
          outcome: roomCaseOutcome(mission.id, exercise, record.casework) }];
      }
      if (mission.kind !== "workbench") return [];
      const choices = record.choices!;
      const base = mission.simulate?.({});
      const workload = mission.simulate?.(choices);
      const result = replayMission(mission, choices).filter(({ passed }) => passed).length;
      const work = records[mission.id].work;
      const outcome = work ? assignmentOutcome(work) : base && workload
        ? `Staff follow-up ${base.staffMinutes} → ${workload.staffMinutes} min · Unresolved or incorrect ${base.unresolved} → ${workload.unresolved} · Direct spend $${(base.cents / 100).toFixed(2)} → $${(workload.cents / 100).toFixed(2)}`
        : `${mission.measure} · 0/${mission.decisions.length} before → ${result}/${mission.decisions.length} after`;
      return [{ place: places.find(({ id }) => id === mission.place)!.name, title: mission.title, outcome }];
    }),
  ];

  function refreshPortfolio() {
    setRecords(readPortfolio(committedDispatchCheck));
  }

  useEffect(() => {
    if (!ready) return;
    const saved = readDispatch();
    if (!saved) return;
    setSavedPolicy(saved);
    setContract(saved.contract);
    setRoutes(saved.routes);
    setResult(runShift(saved.contract, saved.routes));
    setSaveStatus("saved");
    setStep(3);
  }, [ready]);

  useEffect(() => {
    if (view !== "depot" || !user || dispatchAttempt.current) return;
    const request = openDispatchAttempt();
    dispatchAttempt.current = request;
    void request.catch(() => {
      if (dispatchAttempt.current === request) dispatchAttempt.current = null;
    });
  }, [view, user]);

  useEffect(() => {
    if (!ready) return;
    function refresh() {
      const completed = Object.fromEntries(tracks.filter(({ id }) => isCityAssignment(id))
        .map((track) => [track.id, !!readCityAssignment(track)]));
      setCompletedAssignments(completed);
    }
    refresh();
    refreshPortfolio();
    return subscribeToProgress((key, local) => {
      if (local) return;
      if (key === dispatchProgressKey || key === null) setSavedPolicy(readDispatch());
      if (key === activeAssignmentKey) {
        const track = readActiveAssignment();
        if (track) {
          setSelectedCertification(track);
          certificationMenu.current?.close();
        }
      }
      refresh();
      refreshPortfolio();
    });
  }, [ready, committedDispatchCheck]);

  useEffect(() => {
    if (!ready) return;
    const url = new URL(window.location.href);
    const assignmentTrack = tracks.find(({ place }) => place === url.searchParams.get("assignment"));
    const pathwayTrack = tracks.find(({ id }) => id === url.searchParams.get("pathway"));
    const track = assignmentTrack ?? pathwayTrack ?? readActiveAssignment();
    setLoaded(true);
    if (!track) {
      setOpenPicker(true);
      return;
    }
    setSelectedCertification(track);
    if (assignmentTrack || pathwayTrack) saveActiveAssignment(track);
    if (pathwayTrack && url.searchParams.has("mission")) {
      const mission = missionsFor(track.id).find(({ id }) => id === url.searchParams.get("mission"));
      const restored = readPortfolio(committedDispatchCheck);
      const saved = readDispatch();
      const legacy = new Set([
        ...(saved && meetsDispatchGoal(runShift(saved.contract, saved.routes)) ? ["dispatch-lookup"] : []),
        ...(isCityAssignment(track.id) && readCityAssignment(track)
          ? missionsFor(track.id).filter(({ kind }) => kind === "original").map(({ id }) => id) : []),
      ]);
      setDistrict(places.find(({ id }) => id === track.place)!.district);
      if (mission && canEnterMission(mission, restored, legacy)) enterMission(mission, track);
      else {
        replaceMissionLocation();
        if (mission) setRequestedMission(mission.id);
      }
      return;
    }
    if (!assignmentTrack) {
      if (pathwayTrack) {
        setDistrict(places.find(({ id }) => id === track.place)!.district);
        url.searchParams.delete("pathway");
        window.history.replaceState(window.history.state, "", url);
      }
      return;
    }
    const starter = missionsFor(track.id).find(({ kind }) => kind === "original" || kind === "dispatch");
    if (starter) {
      enterMission(starter, track);
      return;
    }
    url.searchParams.delete("assignment");
    window.history.replaceState(window.history.state, "", url);
  }, [ready]);

  useEffect(() => {
    if (openPicker && !certificationMenu.current?.open) {
      certificationMenu.current?.showModal();
      setOpenPicker(false);
    }
  }, [openPicker]);

  useEffect(() => {
    if (view !== "mission" || buildingStation || !restoreStationFocus.current) return;
    restoreStationFocus.current = false;
    stationOpener.current?.focus({ preventScroll: true });
  }, [view, buildingStation]);

  useEffect(() => {
    if (!playing) return;
    if (step >= 3) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setStep((current) => current + 1), 620);
    return () => window.clearTimeout(timer);
  }, [playing, step]);

  function goTo(next: View) {
    if (view === next) return;
    setView(next);
    if (next === "city") {
      setSelectedPlace(null);
      replaceMissionLocation();
    }
    setDistrictMenu(false);
    setInspecting(next === "depot");
    requestAnimationFrame(() => heading.current?.focus());
  }

  function enterDepot() {
    setDistrict("maplewood");
    goTo("depot");
    setInspecting(true);
  }

  function selectPlace(id: PlaceId | null, focus = true) {
    setSelectedPlace(id);
    const place = places.find((site) => site.id === id);
    if (place) setDistrict(place.district);
    setDistrictMenu(false);
    setInspecting(true);
    if (focus) requestAnimationFrame(() => document.getElementById("places-heading")?.focus());
  }

  function chooseTrack(track: Track) {
    certificationMenu.current?.close();
    setSelectedCertification(track);
    saveActiveAssignment(track);
    goTo("city");
    setSelectedPlace(null);
    setInspecting(false);
    setDistrict(places.find(({ id }) => id === track.place)!.district);
    setDistrictMenu(false);
  }

  function openJournal(progress: boolean) {
    if (!selectedCertification) {
      certificationMenu.current?.showModal();
      return;
    }
    setJournalProgress(progress);
    setRequestedMission(null);
    journal.current?.showModal();
  }

  function openMission(mission: Mission, track = selectedCertification, fromSteps = false, study?: "check" | "followup") {
    if (!track || mission.track !== track.id || !canEnterMission(mission, records, legacy)) return;
    if (track !== selectedCertification) {
      setSelectedCertification(track);
      saveActiveAssignment(track);
    }
    setRequestedMission(null);
    journal.current?.close();
    fromLibrarySteps.current = fromSteps;
    enterMission(mission, track, study);
  }

  function enterMission(mission: Mission, track: Track, study?: "check" | "followup") {
    replaceMissionLocation(mission);
    if (mission.kind === "dispatch") {
      enterDepot();
      setDispatchVisit(!study);
      if (study) openCertification(study === "check" ? "first" : "followup");
      return;
    }
    const place = places.find(({ id }) => id === mission.place)!;
    setDistrict(place.district);
    setSelectedPlace(place.id);
    setInspecting(false);
    setDistrictMenu(false);
    setActiveMission(mission.kind === "workbench" ? mission : null);
    setCityAssignment(mission.kind === "original" ? track : null);
    const roomHasStations = hasAssignmentWork(mission.id) || !!caseworkFor(mission.id);
    setTaskConversationOpen(!study && !roomHasStations);
    setBuildingStation(null);
    goTo("mission");
    if (study) openCertification(study === "check" ? "mission-check" : "mission-followup");
  }

  function selectBuildingStation(station: BuildingStation | null) {
    if (station && !buildingStation && document.activeElement instanceof HTMLButtonElement) stationOpener.current = document.activeElement;
    setBuildingStation(station);
    setTaskConversationOpen(station === "work" && !workId && !exercise);
  }

  function returnToMissionPathway() {
    setBuildingStation(null);
    setTaskConversationOpen(false);
    refreshPortfolio();
    if (savedLegacyOutcome.current) {
      savedLegacyOutcome.current = false;
      if (fromLibrarySteps.current) {
        fromLibrarySteps.current = false;
        goTo("city");
      } else openCertification("pathway");
    }
  }

  function openLens() {
    examLens.current?.showModal();
    if (certificationMission && lensQuestion) {
      void recordMissionLens(certificationMission, lensQuestion.id).then(refreshPortfolio);
    }
  }

  function completeCityAssignment(track: Track, choices: Record<string, number>) {
    if (!isCityAssignment(track.id) || !saveCityAssignment(track, choices)) return false;
    setCompletedAssignments((current) => ({ ...current, [track.id]: true }));
    return true;
  }

  function selectStation(id: StationId) {
    setStation(id);
    setInspecting(true);
  }

  function closeInspector() {
    setInspecting(false);
    if (view === "city") setSelectedPlace(null);
    requestAnimationFrame(() => document.getElementById("places-toggle")?.focus());
  }

  useEffect(() => {
    if (!inspecting && !districtMenu) return;
    function dismiss(event: KeyboardEvent) {
      if (event.key !== "Escape" || document.querySelector("dialog[open]")) return;
      if (districtMenu) {
        setDistrictMenu(false);
        document.getElementById("district-toggle")?.focus();
        return;
      }
      setInspecting(false);
      if (view === "city") setSelectedPlace(null);
      document.getElementById("places-toggle")?.focus();
    }
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, [inspecting, districtMenu, view]);

  function visitDistrict(id: DistrictId) {
    setDistrict(id);
    setDistrictVisit((visit) => visit + 1);
    setDistrictMenu(false);
    setInspecting(false);
    setSelectedPlace(null);
    document.getElementById("district-toggle")?.focus();
  }

  function changeContract(value: Contract) {
    if (savingShift.current) return;
    setContract(value);
    setPlaying(false);
    setStep(2);
    setResult(null);
    setSaveStatus(null);
  }

  function changeRoute(condition: Condition, route: Route) {
    if (savingShift.current) return;
    setRoutes((current) => ({ ...current, [condition]: route }));
    setPlaying(false);
    setStep(2);
    setResult(null);
    setSaveStatus(null);
  }

  function compareShift() {
    if (savingShift.current) return;
    setPlaying(false);
    setResult(runShift(contract, routes));
    setSaveStatus(null);
    setStep(3);
    requestAnimationFrame(() => document.getElementById("shift-heading")?.focus());
  }

  async function commitShift() {
    if (savingShift.current) return;
    const policy = { contract, routes };
    setShiftError(null);
    if (user) {
      const scope = progressScope();
      savingShift.current = true;
      setSaveStatus("saving");
      try {
        const attempt = await (dispatchAttempt.current ??= openDispatchAttempt());
        if (progressScope() !== scope) return;
        const previous = dispatchCommand.current;
        const command = previous && JSON.stringify(previous.policy) === JSON.stringify(policy)
          ? previous : { attempt, id: crypto.randomUUID(), policy };
        dispatchCommand.current = command;
        const response = await saveDispatchRun(command);
        if (progressScope() !== scope) return;
        if (response.error) {
          if (response.conflict) {
            dispatchCommand.current = null;
            dispatchAttempt.current = null;
          }
          setShiftError(response.error);
          setSaveStatus("unavailable");
          return;
        }
        dispatchAttempt.current = Promise.resolve({ id: command.attempt.id, revision: command.attempt.revision + 1 });
        dispatchCommand.current = null;
        setSaveStatus("saved");
        if (!savedPolicy || (result && meetsDispatchGoal(result))) setSavedPolicy(policy);
        certification.retryStudy();
        sync();
      } catch {
        if (progressScope() !== scope) return;
        dispatchAttempt.current = null;
        setShiftError("Could not connect to your saved shift. Try again.");
        setSaveStatus("unavailable");
        return;
      } finally {
        savingShift.current = false;
      }
      if (result && meetsDispatchGoal(result)) {
        workflow.current?.close();
        openCertification("pathway");
      }
      return;
    }
    const stored = saveDispatch(policy);
    setSaveStatus(stored ? "saved" : "unavailable");
    if (stored) {
      setSavedPolicy(policy);
      if (result && meetsDispatchGoal(result)) {
        workflow.current?.close();
        openCertification("pathway");
      }
    }
  }

  function openCertification(page: CertificationPage) {
    setCertificationPage(page);
  }

  function openLookup() {
    if (workflow.current) {
      workflow.current.showModal();
      workflow.current.scrollTop = 0;
      document.getElementById("workflow-title")?.focus({ preventScroll: true });
    }
  }

  function replayTicket() {
    setStep(0);
    setPlaying(true);
  }

  return (
    <div className="game-shell">
      <header className="world-hud">
        <div className="header-content">
          <button className="wordmark" type="button" aria-label="CertCity home" onClick={() => goTo("city")}>
            <picture className="wordmark-art">
              <source media="(max-width: 700px)" srcSet="/brand/mark-reversed.svg" width={400} height={400} />
              <img src="/brand/wordmark-reversed.svg" width={2000} height={545} alt="" />
            </picture>
          </button>
          <div className="district-switcher">
            <h1 ref={heading} tabIndex={-1}>
              {view === "city"
                ? <button className="world-title" type="button" id="district-toggle" aria-label="Choose district"
                    aria-expanded={districtMenu} aria-controls="district-menu" onClick={() => setDistrictMenu((open) => !open)}>
                    <MapPin size={16} aria-hidden="true" />
                    <span className="world-title-label">{districts.find(({ id }) => id === district)?.name}</span>
                    <ChevronDown size={15} aria-hidden="true" />
                  </button>
                : <span className="world-title"><MapPin size={17} aria-hidden="true" />{view === "mission" ? activePlace?.shortName ?? "Assignment" : dispatchName}</span>}
            </h1>
            {view === "city" && districtMenu && (
              <nav id="district-menu" className="district-menu" aria-label="Choose a district">
                {districts.map(({ id, name, description }) => (
                  <button className="district-option" key={id} type="button" aria-current={district === id ? "location" : undefined}
                    onClick={() => visitDistrict(id)}>
                    <span><strong>{name}</strong><small>{description}</small></span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                ))}
              </nav>
            )}
          </div>
          <nav aria-label="Game views" className="main-nav">
            {view !== "city" && (
              <button className="nav-button" type="button" onClick={() => goTo("city")}>
                <Map size={17} aria-hidden="true" /> City
              </button>
            )}
            {view !== "mission" && <button className="nav-button" type="button" id="places-toggle" aria-expanded={inspecting}
              onClick={() => {
                if (inspecting) closeInspector();
                else if (view === "city") selectPlace(null);
                else setInspecting(true);
              }}>
              <MapPin size={17} aria-hidden="true" /> {view === "city" ? "Places" : "Stations"}
            </button>}
            {view === "city" && (
              <button className="nav-button assignments-nav" type="button" aria-haspopup="dialog" aria-label="Assignments"
                onClick={() => openJournal(false)}>
                <ClipboardList size={17} aria-hidden="true" /> <span>Assignments</span>
              </button>
            )}
            <button className="nav-button certification-nav" type="button" aria-haspopup="dialog" aria-label="Certifications"
              onClick={() => moduleSteps ? openCertification("pathway") : certificationMenu.current?.showModal()}>
              <GraduationCap size={18} aria-hidden="true" /> <span>{selectedCertification?.code ?? "Certifications"}</span>
            </button>
            <AccountButton city />
          </nav>
        </div>
      </header>

      <main className="game-world">
          {view === "city" ? (
            <WorldScene
              key="city"
              kind="city"
              district={district}
              districtVisit={districtVisit}
              panelOpen={inspecting}
              description="CertCity’s 3D city. Choose a building, move the camera, or open Places."
              markers={markers}
              selected={selectedPlace}
              onSelect={selectPlace}
              onTalk={setPlaceVisit}
              conversationMarker={nolanMarker}
              assignmentComplete={libraryComplete}
              assignmentStatuses={cityStatuses}
            />
          ) : view === "depot" ? (
            <WorldScene
              key="depot"
              kind="depot"
              panelOpen={inspecting}
              staffHours={effectiveResult?.staffHours ?? baselineShift.staffHours}
              description="City Dispatch 3D cutaway with a support counter, order lookup terminal, and dispatch bench."
              markers={stations}
              selected={station}
              onSelect={selectStation}
            />
          ) : (
            <WorldScene
              key={`mission-${interiorMission?.id ?? "unknown"}`}
              kind="mission"
              missionRoom={interior ? { ...interior, missionId: interiorMission?.id, workId, surface: exercise && interiorMission ? workLayout(interiorMission.id).kind : undefined } : undefined}
              assignmentComplete={missionComplete}
              panelOpen={buildingStation === "work" || buildingStation === "evidence"}
              description={`${interior?.room ?? "Assignment room"} interior for ${interiorMission?.title ?? "the assignment"}.`}
              markers={buildingMarkers}
              selected={buildingStation}
              onSelect={selectBuildingStation}
              assignmentStatuses={missionComplete ? { work: "Assignment complete" } : undefined}
            />
          )}

          <div className="city-status-hud">
            <CityImpact savedShift={savedResult} savedAssignments={savedCityOutcomes} inRoom={view === "mission"} dialog={impactDialog} />
            {moduleProgress}
            {view === "city" && loaded && selectedCertification && <button className="button button-outline pathway-progress-button" type="button" onClick={() => openJournal(true)}>
              <GraduationCap size={17} aria-hidden="true" /> Pathway progress
            </button>}
          </div>

          {view === "mission" && interior && interiorMission && <aside className="building-work-dock" aria-label="Inside the building">
            <div className="building-arrival">
              <header><h2>{interior.room}</h2>{missionComplete && <span>Outcome saved</span>}</header>
              <p>{interior.arrival}</p>
              <p className="building-first-action" data-saved={!!localOutcome || undefined}>{localOutcome ?? roomFirstAction(interiorMission.id, interior.interviews[0].opening)}</p>
            </div>
            <div className="building-station-controls">
              <button type="button" className="button button-primary" aria-haspopup="dialog" onClick={() => selectBuildingStation("work")}>
                <Wrench size={16} aria-hidden="true" />{workLabel}<ArrowRight size={16} aria-hidden="true" />
              </button>
              <div>{buildingMarkers.filter(({ id }) => id !== "work").map(({ id, name, icon: Icon }) =>
                <button key={id} type="button" className="button button-outline" aria-haspopup="dialog" onClick={() => selectBuildingStation(id)}>
                  <Icon size={16} aria-hidden="true" />{name}
                </button>)}</div>
            </div>
          </aside>}

          {loaded && !inspecting && view !== "mission" && (
            <button className="quest-hud" type="button" aria-haspopup="dialog" onClick={() => openJournal(false)}>
              <span className="assignment-icon"><ClipboardList size={20} aria-hidden="true" /></span>
              <span><span className="small-label">{selectedCertification?.code ?? "Certification pathways"}</span>
                <strong>{selectedCertification ? `${available.length} ${available.length === 1 ? "mission" : "missions"} available` : "Choose a certification"}</strong></span>
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          )}
          {inspecting && view !== "mission" && (
            <div className="inspection-panel">
              <button className="icon-button panel-close" type="button" aria-label="Close inspection" onClick={closeInspector}>
                <X size={19} aria-hidden="true" />
              </button>
              {view === "city"
                ? <CityInspector selected={selectedPlace} district={district} onSelect={selectPlace} onMission={openMission}
                    onTalk={setPlaceVisit} missions={missions} records={records} legacy={legacy} />
                : <DepotInspector selected={station} result={effectiveResult} onSelect={selectStation} onSystem={openLookup} onTalk={() => setDispatchVisit(true)} />}
            </div>
          )}
      </main>

      <dialog className="game-dialog workflow-dialog" ref={workflow} onClose={() => setPlaying(false)} aria-labelledby="workflow-title">
        <div className="dialog-header">
          <ScanLine size={22} aria-hidden="true" />
          <h2 id="workflow-title" tabIndex={-1}>Order lookup</h2>
          {view === "depot" && moduleProgress}
          <button className="icon-button" type="button" onClick={() => workflow.current?.close()} aria-label="Close workflow">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="work-area system-area">
          <DispatchBrief contract={contract} result={result} status={saveStatus} step={step} onReplay={() => {
            document.getElementById("ticket-heading")?.focus();
            replayTicket();
          }} />
          <SystemBoard contract={contract} routes={routes} step={step} playing={playing}
            onReplay={replayTicket}
            onEditRules={() => {
              setPlaying(false);
              setStep(2);
              focusTicketRule(contract);
            }}
            onStep={() => {
              setPlaying(false);
              setStep((current) => (current + 1) % 4);
            }}
          />
          <SystemControls
            contract={contract} routes={routes}
            onContract={changeContract} onRoute={changeRoute}
            onRun={compareShift} onLens={() => {
              setPlaying(false);
              examLens.current?.showModal();
            }}
          />
          {result && <ShiftSummary result={result} contract={contract} routes={routes} status={saveStatus}
            signedIn={!!user} error={shiftError} onSave={() => void commitShift()} />}
        </div>
      </dialog>

      <CityCertificationDialog dialog={certificationMenu} selected={selectedCertification} onSelect={chooseTrack} />
      {selectedCertification && <MissionJournal dialog={journal} track={selectedCertification} records={records} legacy={legacy}
        progress={journalProgress} requestedMission={requestedMission} onMission={openMission} onStudy={(mission, page) => openMission(mission, selectedCertification, false, page)}
        dispatchDueAt={certification.progress.followup ? null : certification.dueAt ?? (certification.progress.first ? followupAt(certification.progress.first) : null)}
        onChangeTrack={() => {
          journal.current?.close();
          certificationMenu.current?.showModal();
        }} />}
      {view === "mission" && interior && buildingStation && interiorMission && !taskConversationOpen && (buildingStation !== "work" || workId || exercise) &&
        <BuildingAssignmentDialog key={`${interiorMission.id}:${buildingStation}`} mission={interiorMission} id={workId} experience={interior} caseFiles={activeCase?.cases}
          station={buildingStation} dialog={buildingDialog} record={records[interiorMission.id]} onChange={refreshPortfolio} moduleProgress={moduleProgress}
          onClose={() => {
            if (openPriorReplay.current) {
              openPriorReplay.current = false;
              setBuildingStation("work");
              setTaskConversationOpen(true);
              return;
            }
            restoreStationFocus.current = !savedBuildingOutcome.current;
            setBuildingStation(null);
            if (savedBuildingOutcome.current) {
              savedBuildingOutcome.current = false;
              openCertification("pathway");
            }
          }}
          onLegacyReplay={exercise && (caseRecord?.choices || caseRecord?.draft || activeSave) ? () => {
            openPriorReplay.current = true;
            buildingDialog.current?.close();
          } : undefined}
          onWork={() => selectBuildingStation("work")}
          onSaved={() => {
            savedBuildingOutcome.current = true;
            buildingDialog.current?.close();
          }} />}
      {taskConversationOpen && activeMission?.kind === "workbench" && <MissionWorkbench key={`workbench:${activeMission.id}`} mission={activeMission} record={records[activeMission.id]}
        dialog={missionDialog} enterWork={buildingStation === "work"} onChange={refreshPortfolio} onTaskSaved={() => { savedLegacyOutcome.current = true; missionDialog.current?.close(); }}
        onClose={returnToMissionPathway} moduleProgress={moduleProgress} />}
      {taskConversationOpen && cityAssignment && activeCase && activePlace && isCityAssignment(cityAssignment.id) &&
        <CityAssignmentDialog key={`city-assignment:${cityAssignment.id}`} dialog={cityAssignmentDialog} assignment={activeCase}
          mission={interiorMission!} enterWork={buildingStation === "work"} record={records[interiorMission!.id]} experience={missionExperiences[interiorMission!.id]!}
          person={activePlace.person} role={activePlace.role} savedChoices={activeSave?.choices ?? null} complete={!!completedAssignments[cityAssignment.id]}
          onClose={returnToMissionPathway} onCheck={refreshPortfolio} onComplete={(choices) => completeCityAssignment(cityAssignment, choices)}
          onTaskSaved={() => { savedLegacyOutcome.current = true; cityAssignmentDialog.current?.close(); }} moduleProgress={moduleProgress} />}
      {visitorPlace && <PlaceConversation key={visitorPlace.id} dialog={visitDialog} place={visitorPlace}
        library={visitorPlace.id === "olive-library" ? {
          complete: libraryComplete,
          action: libraryComplete ? "View Central Library" : selectedCertification?.id === libraryTrack.id ? referenceDesk.title : "Switch to CCAR-F and start",
          onContinue: () => {
            if (libraryComplete) selectPlace("olive-library");
            else openMission(referenceDesk, libraryTrack, true);
          },
        } : undefined}
        onClose={() => setPlaceVisit(null)} />}
      {dispatchVisit && <DispatchConversation dialog={dispatchDialog} onClose={() => setDispatchVisit(false)} onSystem={openLookup}
        moduleProgress={moduleProgress} />}
      <CertificationDialog dialog={certificationDialog} page={certificationPage} progress={certification.progress}
        shiftComplete={shiftComplete} sessionOnly={certification.sessionOnly} mission={certificationMission}
        startStudy={certification.startStudy} studyPending={certification.studyPending}
        studyError={certification.studyError} retryStudy={certification.retryStudy} studyDueAt={certification.dueAt}
        browserStudy={certification.browserStudy}
        missionRecord={missionRecord} missionComplete={missionComplete}
        onMissionChange={refreshPortfolio} onMissionStart={() => {
          certificationDialog.current?.close();
          if (buildingDialog.current?.open || missionDialog.current?.open || cityAssignmentDialog.current?.open) return;
          requestAnimationFrame(() => selectBuildingStation("work"));
        }} onNavigate={openCertification}
        onClose={() => setCertificationPage(null)} onDispatch={() => {
          certificationDialog.current?.close();
          if (dispatchDialog.current?.open || workflow.current?.open) return;
          enterDepot();
          setDispatchVisit(true);
        }} onLens={openLens}
        onDispatchDebrief={() => certification.update({ kind: "debrief" })}
        onSubmit={async (stage, answers) => {
          const error = await certification.update({ kind: "submit", stage, answers });
          if (!error) refreshPortfolio();
          return error;
        }} />
      <ExamLens key={`lens:${certificationMission?.id ?? "dispatch"}`} dialog={examLens} question={lensQuestion}
        onPractice={() => {
          if (certificationMission && lensQuestion) void recordMissionLens(certificationMission, lensQuestion.id, true).then(refreshPortfolio);
          else void certification.update({ kind: "practice" });
        }} />
    </div>
  );
}
