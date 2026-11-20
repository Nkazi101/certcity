import type { Choices } from "./missions";

export type Workload = {
  name: string;
  rows: readonly { name: string; requests: number; outcome: string }[];
  staffMinutes: number;
  unresolved: number;
  cents: number;
  goals: readonly { name: string; passed: boolean }[];
};

export function replayPeakDispatch(choices: Choices): Workload {
  const retry = (choices["2.2"] ?? [0])[0];
  const report = (choices["5.3"] ?? [0])[0];
  const scope = (choices["5.2"] ?? [0])[0];
  const timeouts = 48;
  const fastEnough = retry === 1;
  const repeats = retry === 0 ? 120 : retry === 1 ? 32 : 0;
  const recovered = fastEnough ? 24 : 0;
  const unknown = timeouts - recovered;
  const routeAll = report === 0;
  const routeNone = report === 2;
  const humanRequests = 12;
  const ambiguous = 18;
  const authorized = scope === 1;
  const handoffs = (routeAll ? 120 : routeNone ? 0 : unknown) + (authorized ? humanRequests : scope === 2 ? ambiguous + humanRequests : 0);
  const staffMinutes = handoffs * 3;
  const falseAnswers = (routeNone ? unknown : 0) + (scope === 0 ? ambiguous : 0);
  const unhonored = scope === 0 ? humanRequests : 0;
  const cents = 120 * 2 + repeats * 2;
  return {
    name: "Monday peak · 120 requests",
    rows: [
      { name: "Supplier timeouts", requests: timeouts, outcome: `${recovered} recovered inside the deadline. ${unknown} remained unverified.` },
      { name: "Support queue", requests: handoffs, outcome: `${staffMinutes} staff minutes needed. Shift limit is 120 minutes.` },
      { name: "Customer answers", requests: 120, outcome: `${falseAnswers} unsupported replies and ${unhonored} unhonored human requests.` },
    ],
    staffMinutes, unresolved: falseAnswers + unhonored, cents,
    goals: [
      { name: "No unsupported replies or ignored human requests", passed: falseAnswers === 0 && unhonored === 0 },
      { name: "At most 120 minutes of staff follow-up", passed: staffMinutes <= 120 },
      { name: "At most $3.20 in lookup spend", passed: cents <= 320 },
    ],
  };
}

export function replayMarketRush(choices: Choices): Workload {
  const split = (choices["4.5"] ?? [0])[0];
  const context = (choices["5.1"] ?? [0])[0];
  const review = (choices["5.5"] ?? [0])[0];
  const live = split === 1 ? 16 : split === 2 ? 52 : 0;
  const batched = 52 - live;
  const late = split === 0 ? 16 : split === 2 ? 4 : 0;
  const wrongDates = context === 1 ? 0 : context === 2 ? 3 : 8;
  const handwritten = 12;
  const reviewCount = review === 1 ? 14 : review === 2 ? 6 : 32;
  const mistakes = review === 1 ? 0 : review === 2 ? 4 : 2;
  const staffMinutes = reviewCount * 4;
  const cents = live * 5 + batched * 2;
  return {
    name: "Vendor rush · 52 requests",
    rows: [
      { name: "Counter confirmations", requests: 16, outcome: `${late} missed the response deadline.` },
      { name: "Order records", requests: 52, outcome: `${wrongDates} wrong dates and ${mistakes} uncorrected amounts, including a sample of ${handwritten} handwritten invoices.` },
      { name: "Review queue", requests: reviewCount, outcome: `${staffMinutes} minutes of staff work. Shift limit is 60 minutes.` },
    ],
    staffMinutes, unresolved: late + wrongDates + mistakes, cents,
    goals: [
      { name: "Every counter confirmation on time", passed: late === 0 },
      { name: "No wrong dates or uncorrected totals", passed: wrongDates + mistakes === 0 },
      { name: "At most 60 staff minutes and $1.60 in processing", passed: staffMinutes <= 60 && cents <= 160 },
    ],
  };
}

export function replayVendorImport(choices: Choices): Workload {
  const mode = (choices["2.3"] ?? [0])[0];
  const identity = (choices["2.4"] ?? [0])[0];
  const cache = (choices["5.4"] ?? [0])[0];
  const examples = (choices["6.2"] ?? [0])[0];
  const counter = 12;
  const archive = 48;
  const late = mode === 0 ? counter : mode === 2 ? 7 : 0;
  const retried = identity === 1 ? 3 : archive;
  const duplicates = identity === 1 ? 0 : archive - 3;
  const misplaced = identity === 0 ? 6 : 0;
  const wrongFields = examples === 1 ? 0 : examples === 2 ? 4 : 7;
  const staffMinutes = (duplicates + misplaced + wrongFields) * 3;
  const archiveRate = mode === 2 ? 4 : 2;
  const liveRate = mode === 0 ? 2 : 4;
  const cents = counter * liveRate + (archive + retried) * archiveRate + (cache === 1 ? 12 : 60);
  const unresolved = late + duplicates + misplaced + wrongFields + (cache === 2 ? 12 : 0);
  return {
    name: "Import replay · 60 incoming records",
    rows: [
      { name: "Counter replies", requests: counter, outcome: `${late} missed the six-second deadline.` },
      { name: "Archive import", requests: archive, outcome: `${retried} resubmitted. ${duplicates} duplicates and ${misplaced} misassigned results.` },
      { name: "Vendor reference", requests: 7, outcome: `${wrongFields} blank or unreadable IDs given the wrong status.` },
    ],
    staffMinutes, unresolved, cents,
    goals: [
      { name: "All counter requests on time", passed: late === 0 },
      { name: "No duplicates, incorrect fields, or cross-vendor responses", passed: unresolved === 0 },
      { name: "Spend at most $1.80 for the replay", passed: cents <= 180 },
    ],
  };
}

export function replayPilotGate(choices: Choices): Workload {
  const metrics = (choices["4.1"] ?? [0])[0];
  const grader = (choices["4.2"] ?? [0])[0];
  const canary = (choices["4.3"] ?? [0])[0];
  const drift = (choices["4.6"] ?? [0])[0];
  const fairness = (choices["5.5"] ?? [0])[0];
  const coverage = grader === 1 ? 24 : grader === 0 ? 12 : 8;
  const reviews = coverage + (drift === 1 ? 6 : 0) + (fairness === 1 ? 8 : 0);
  const staffMinutes = reviews * 2;
  const missedAppeals = canary === 1 ? 0 : canary === 2 ? 4 : 3;
  const missedLayout = drift === 1 ? 0 : 3;
  const missedExclusions = fairness === 1 ? 0 : 4;
  const unresolved = missedAppeals + missedLayout + missedExclusions;
  const cents = 160 + coverage * 2;
  return {
    name: "Pilot replay · 40 eligible cases and a new layout",
    rows: [
      { name: "Appeals slice", requests: 8, outcome: `${missedAppeals} known appeal regressions escape the promotion gate.` },
      { name: "New layout and small organizations", requests: 14, outcome: `${missedLayout} layout errors and ${missedExclusions} false exclusions remain unflagged.` },
      { name: "Reviewer queue", requests: reviews, outcome: `${staffMinutes} minutes are reserved for sampled review.` },
    ],
    staffMinutes, unresolved, cents,
    goals: [
      { name: "Require quality, cost, and tail-latency evidence", passed: metrics === 1 },
      { name: "Validate exact fields and human-reviewed quality", passed: grader === 1 },
      { name: "Catch the known failures within 80 reviewer minutes", passed: unresolved === 0 && staffMinutes <= 80 },
    ],
  };
}

export function replaySchoolPilot(choices: Choices): Workload {
  const tone = (choices["1.3"] ?? [0])[0];
  const scope = (choices["2.2"] ?? [0])[0];
  const intervention = (choices["4.1"] ?? [0])[0];
  const draft = (choices["4.3"] ?? [0])[0];
  const report = (choices["4.5"] ?? [0])[0];
  const pilotSize = 30;
  const pending = intervention === 1 && draft === 1 ? 2 : intervention === 1 || draft === 1 ? 6 : 10;
  const wrongScope = scope === 1 ? 0 : 1;
  const missingLists = tone === 1 ? 0 : tone === 0 ? 4 : 6;
  const staffMinutes = pilotSize * 11 + pending * 3 + missingLists * 2;
  const cents = pilotSize * (draft === 1 ? 4 : 6);
  const unresolved = wrongScope + missingLists;
  return {
    name: "Notice pilot · 30 family messages",
    rows: [
      { name: "Draft and review", requests: pilotSize, outcome: `${staffMinutes} staff minutes, including ${pending} incomplete forms handled by the existing referral process.` },
      { name: "Published claims", requests: pilotSize, outcome: `${wrongScope} claims outside the observed group and ${missingLists} missing document lists.` },
      { name: "Board report", requests: 1, outcome: report === 1 ? "The report includes drafting, review and corrections." : "The report omits staff review or the corrections." },
    ],
    staffMinutes, unresolved, cents,
    goals: [
      { name: "No unsupported claims or missing document lists", passed: unresolved === 0 },
      { name: "At most 340 minutes with the current referral policy", passed: staffMinutes <= 340 },
      { name: "Report net staff effort and corrections", passed: report === 1 },
    ],
  };
}
