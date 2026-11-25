"use client";

import { GraduationCap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { progressScope, subscribeToProgress } from "../lib/progress-storage";
import { dispatchStudyRequest } from "../lib/supabase/study";
import type { DispatchStudy } from "../lib/supabase/study";
import { useAccount } from "./account";
import type { CheckStage } from "../lib/certification";
import { checkForAttempt, skillChecks } from "../lib/exam-practice";
import type { SkillCheck } from "../lib/exam-practice";
import {
  certificationKey, dispatchPreparationSteps, emptyProgress, followupAt, followupDays, gradeAttempt, isCorrect, readCertification, updateCertification,
} from "../lib/certification-progress";
import type { CertificationProgress, SkillAttempt } from "../lib/certification-progress";

// The City Dispatch study progress hook and the Progress button, apart from the certification dialog so the city can
// show progress on first paint and load the dialog (with its question content) later.

export function useCertificationProgress(shiftComplete: boolean) {
  const { ready, user } = useAccount();
  const userId = user?.id;
  const [progress, setProgress] = useState(emptyProgress);
  const [sessionOnly, setSessionOnly] = useState(false);
  const [study, setStudy] = useState<DispatchStudy | null>(null);
  const [studyError, setStudyError] = useState<string | null>(null);
  const [reloadStudy, setReloadStudy] = useState(0);
  const latest = useRef(emptyProgress);

  useEffect(() => {
    if (!ready) return;
    function restore() {
      const stored = readCertification() ?? emptyProgress;
      latest.current = stored;
      setProgress(stored);
      setSessionOnly(false);
    }
    restore();
    return subscribeToProgress((key, local) => {
      if (!local && (key === certificationKey || key === null)) restore();
    });
  }, [ready]);

  useEffect(() => {
    if (!ready || !userId || !shiftComplete) return;
    const controller = new AbortController();
    const restore = async () => {
      const response = await dispatchStudyRequest<DispatchStudy>("status", undefined, undefined, controller.signal);
      if (controller.signal.aborted) return;
      setStudyError(response.error);
      if (response.data) {
        const incoming = response.data;
        setStudy((current) => ({
          ...incoming,
          first: incoming.first ?? current?.first ?? null,
          followup: incoming.followup ?? current?.followup ?? null,
          dueAt: incoming.dueAt ?? current?.dueAt ?? null,
        }));
      }
    };
    void restore();
    window.addEventListener("focus", restore);
    return () => {
      controller.abort();
      window.removeEventListener("focus", restore);
    };
  }, [ready, userId, shiftComplete, reloadStudy]);

  const recordResult = useCallback((stage: CheckStage, result: SkillAttempt) => {
    setStudy((current) => current && {
      ...current,
      [stage]: result,
      dueAt: stage === "first" ? followupAt(result) : current.dueAt,
    });
  }, []);

  const startStudy = useCallback(async (stage: CheckStage, signal: AbortSignal) => {
    const response = await dispatchStudyRequest<{ result?: SkillAttempt }>("start", stage, undefined, signal);
    if (!signal.aborted && response.data?.result) recordResult(stage, response.data.result);
    return response.error;
  }, [recordResult]);

  async function update(action: Parameters<typeof updateCertification>[1]) {
    if (action.kind === "submit" && study?.eligible) {
      const scope = progressScope();
      const response = await dispatchStudyRequest<{ result: SkillAttempt }>("submit", action.stage, action.answers);
      if (progressScope() !== scope) return "Your account changed. Try again.";
      if (response.data?.result) recordResult(action.stage, response.data.result);
      return response.error;
    }
    const { progress: updated, saved, error } = await updateCertification(latest.current, action);
    if (!error) {
      latest.current = updated;
      setProgress(updated);
      setSessionOnly(!saved);
    }
    return error;
  }

  const displayProgress = study?.eligible ? {
    ...progress, first: study.first, followup: study.followup,
  } : progress;
  return {
    progress: displayProgress, sessionOnly, update,
    startStudy: study?.eligible ? startStudy : undefined,
    studyPending: !!userId && shiftComplete && !study,
    studyError,
    retryStudy: () => setReloadStudy((current) => current + 1),
    dueAt: study?.eligible ? study.dueAt : null,
    committedDispatchCheck: study?.eligible ? study.first : undefined,
    browserStudy: study?.eligible ? { first: progress.first, followup: progress.followup } : undefined,
  };
}


export function ModuleProgressButton({ completed, onOpen }: { completed: readonly boolean[]; onOpen: () => void }) {
  const count = completed.filter(Boolean).length;
  return <button className="button button-outline module-progress-button" type="button" aria-haspopup="dialog"
    aria-label={`Progress, ${count} of ${completed.length} steps`} onClick={onOpen}>
    <GraduationCap size={17} aria-hidden="true" />
    <span>Progress</span>
    <span className="module-progress-count" aria-hidden="true">{count}/{completed.length}</span>
  </button>;
}

