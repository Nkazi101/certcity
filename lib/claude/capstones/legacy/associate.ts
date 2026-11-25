import { integer, sameMembers, test, words } from "../model";
import type { CapstoneDefinition, CapstoneStage } from "../model";

type NoticeCase = {
  id: string;
  stage: CapstoneStage;
  title: string;
  brief: string;
  event: string;
  draft: { date: string; hours: string; venue: string; capacity: number; extra: string };
  date: string;
  hours: string;
  venue: string;
  capacity: number;
  contact: string;
  reviewer: string;
  scheduleId: string;
  operationsId: string;
};

function notice(input: NoticeCase): CapstoneDefinition {
  const { id, stage, title, brief, event, draft, date, hours, venue, capacity, contact, reviewer, scheduleId, operationsId } = input;
  return {
    id, stage, title, role: "Publishing desk", brief,
    deliverable: "Repair the public notice, cite the records behind the changes, and assemble the review handoff.",
    documents: [
      {
        id: "DRAFT", title: "Draft under review",
        text: `${event}\n${draft.date} · ${draft.hours} · ${draft.venue}\nCapacity ${draft.capacity}. ${draft.extra}\nNo sign-off recorded.`,
      },
      {
        id: scheduleId, title: "Signed schedule correction",
        text: `The signed calendar now specifies ${date}, ${hours}, at ${venue}. This correction supersedes the date and location in the draft.`,
      },
      {
        id: operationsId, title: "Operating notes",
        text: `The approved capacity is ${capacity}. Residents with access questions should contact ${contact}. ${reviewer} signs off on public notices. A supply proposal remains unconfirmed.`,
      },
    ],
    fields: [
      { id: "date", label: "Public date", instruction: "Use YYYY-MM-DD.", initial: draft.date },
      { id: "hours", label: "Public hours", instruction: "Use a 24-hour range, such as 09:00–11:00.", initial: draft.hours },
      { id: "venue", label: "Venue", initial: draft.venue },
      { id: "capacity", label: "Confirmed capacity", initial: String(draft.capacity) },
      { id: "contact", label: "Contact for access questions" },
      { id: "extra", label: "Extra public announcement", instruction: "Optional. Leave blank when the records support no additional announcement.", initial: draft.extra },
      { id: "sources", label: "Source IDs used for the notice", instruction: "Separate multiple IDs with a comma." },
      { id: "reviewer", label: "Send the draft to this reviewer" },
      { id: "notes", label: "Notes to the reviewer", editor: "notes", instruction: "Optional. The simulation saves these notes with your draft. The checks cover the structured notice fields." },
    ],
    criteria: [
      {
        id: "calendar", title: "Use the signed calendar",
        objectives: ["2.1", "2.3"], revisedObjectives: ["2.1", "2.2"],
        review: "Check the approval state and date of each source, then carry the corrected public details across together.",
      },
      {
        id: "services", title: "Publish support information that staff can deliver",
        objectives: ["2.1", "2.3"], revisedObjectives: ["2.1", "2.2"],
        review: "Check the capacity and public contact against the operating record.",
      },
      {
        id: "basis", title: "Keep a traceable basis for the changes",
        objectives: ["2.3"], revisedObjectives: ["2.2"],
        review: "Preserve the signed calendar and operations record IDs so a reviewer can reproduce the comparison. The draft is evidence of what changed.",
      },
      {
        id: "hold", title: "Protect the release decision",
        objectives: ["2.4", "6.3"], revisedObjectives: ["2.3", "6.3"],
        review: "Hold unconfirmed offers out of the public notice and leave release authority with the person named in the operating notes.",
      },
    ],
    preview: (value) => ({
      kind: "notice", title: event,
      body: [
        `${value.date || "Date pending"} · ${value.hours || "Hours pending"} · ${value.venue || "Venue pending"}`,
        `Capacity ${value.capacity || "pending"}. Access questions ${value.contact || "contact pending"}.`,
        value.extra,
      ].filter(Boolean).join("\n\n"),
      handoff: [`Review handoff to ${value.reviewer || "reviewer pending"}`, `Sources ${value.sources || "pending"}`, value.notes]
        .filter(Boolean).join("\n"),
    }),
    exercise: (value) => {
      const enteredHours = words(value.hours).replace(/\s*[-–—]\s*/g, "–");
      const cited = (value.sources ?? "").split(/[,;\n]/).map((row) => row.trim().toUpperCase()).filter(Boolean);
      return [
        test("calendar", words(value.date) === date && enteredHours === hours && words(value.venue) === words(venue),
          "The date, hours, and venue agree with the signed schedule.", "A date, time range, or venue still differs from the signed schedule."),
        test("services", integer(value.capacity) === capacity && words(value.contact) === words(contact),
          "The capacity and access contact agree with operations.", "The capacity or the contact still needs to be confirmed against the operating notes."),
        test("basis", sameMembers(cited, [scheduleId, operationsId]),
          "Both authoritative records travel with the notice.", "The reviewer needs the IDs of both records that authorize the new details."),
        test("hold", !words(value.extra) && words(value.reviewer) === words(reviewer),
          "The unconfirmed offer is held out and the release goes to its reviewer.", "Remove the unsupported offer and route the draft to the person with release authority."),
      ];
    },
    reference: { label: "Review project knowledge and instructions", url: "https://support.claude.com/en/articles/9519177-how-can-i-create-and-manage-projects" },
  };
}

export const associateDefinitions = {
  capstone: notice({
    id: "associate-riverbend-reopening-v1", stage: "capstone", title: "Reissue a public reopening notice",
    brief: "Riverbend reopened its reading room after repairs. The draft was written before Facilities revised its schedule and staffing plan. A colleague has asked you to reconcile the records and prepare a release for review.",
    event: "Riverbend Reading Room reopening",
    draft: { date: "2026-11-24", hours: "09:00–17:00", venue: "West Entrance", capacity: 70, extra: "Free Wi-Fi hotspots for every visitor." },
    date: "2026-11-26", hours: "10:00–15:00", venue: "North Lobby", capacity: 32,
    contact: "access@riverbend.example", reviewer: "Mina Das", scheduleId: "RB-26", operationsId: "OPS-09",
  }),
  transfer: notice({
    id: "associate-sparrow-lending-transfer-v1", stage: "transfer", title: "Revise a lending pickup announcement",
    brief: "Sparrow Tool Library has moved its volunteer-led collection. A fundraising draft announced the old address and an equipment giveaway. Reconcile the verified pickup information before the notice reaches members.",
    event: "Sparrow Tool Library pickup",
    draft: { date: "2026-12-05", hours: "11:00–16:00", venue: "Canal Yard", capacity: 65, extra: "All members receive a free drill." },
    date: "2026-12-08", hours: "15:30–19:00", venue: "Depot Room B", capacity: 24,
    contact: "pickup@sparrow.example", reviewer: "Owen Lam", scheduleId: "SP-19", operationsId: "VOL-08",
  }),
};

export const associateRevisedDefinitions = {
  capstone: notice({
    id: "associate-willow-clinic-revised-v1", stage: "capstone", title: "Correct a public service desk notice",
    brief: "Willow Community Center’s draft promised walk-in device help at a library location. A later operations record changes staffing and the approved schedule. Repair the notice and prepare its approval handoff.",
    event: "Willow Community Center device help",
    draft: { date: "2026-12-14", hours: "10:00–18:00", venue: "Central Library", capacity: 50, extra: "All visitors receive a laptop repair." },
    date: "2026-12-16", hours: "13:00–17:30", venue: "Maple Studio", capacity: 28,
    contact: "helpdesk@willow.example", reviewer: "Samir Tate", scheduleId: "WL-31", operationsId: "OPS-17",
  }),
  transfer: notice({
    id: "associate-garden-seed-transfer-revised-v1", stage: "transfer", title: "Prepare a seed exchange update",
    brief: "The garden team moved a members’ seed exchange away from the greenhouse. Its initial update still uses the earlier capacity and promises free equipment. Verify the records and assign the release to its owner.",
    event: "Brook Garden seed exchange",
    draft: { date: "2026-12-21", hours: "09:00–16:00", venue: "East Greenhouse", capacity: 75, extra: "Free starter kits for each household." },
    date: "2026-12-23", hours: "09:30–13:00", venue: "Community Room 2", capacity: 36,
    contact: "seeds@brook.example", reviewer: "Rina Voss", scheduleId: "BG-12", operationsId: "GDN-06",
  }),
};
