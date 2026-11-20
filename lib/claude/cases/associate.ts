import { field as f, fixture as r, quantity as q } from "../casework";
import type { Casework } from "../casework";

export const associateCases = {
  "enrollment-replies": {
    station: "Family inbox", view: "document",
    opening: "We sent last year’s deadline to a family. Can you get the next three replies ready before we open?",
    task: "Use the papers on Jordan’s desk to edit the deadline line and decide how the office should handle dates it cannot confirm.",
    references: [["Signed bulletin", "New applications close May 24. The reopening date is pending."], ["Old reply template", "New applications close May 19."], ["Late request policy", "Only the enrollment lead can approve an exception. Keep the request and its reason together."]],
    fields: [f("date", "New enrollment reply", "May 19", "May 19", "May 24", "Date pending"), f("pending", "When the bulletin has no date", "Use last date", "Use last date", "Mark pending", "Confirm today"), f("late", "Late application", "Confirm", "Confirm", "Hold for lead", "Reject")],
    cases: [
      r("Avery’s enrollment reply", "The family asks about the current first-time enrollment deadline.", [["date", "May 24"]], "The draft does not give the date from the signed bulletin.", "Draft: New enrollment closes May 24. Source attached: signed bulletin."),
      r("Repair reopening reply", "There is no date in the latest maintenance update.", [["pending", "Mark pending"]], "The draft claims a date that the office cannot verify.", "Draft: The reopening date is pending. We’ll confirm it once announced."),
    ],
    retest: r("Late request from another family", "A family asks for an exception and supplies a reason.", [["late", "Hold for lead"]], "The request was decided without the official who owns exceptions.", "The lead’s tray has the family’s request and the supplied reason."),
    output: ({ date, pending, late }) => [
      ["Family inbox", `New enrollment closes ${date}.\nRepair reopening · ${pending}.\nLate enrollment request · ${late}.`],
    ],
    debrief: "Ground the reply in the current source. Missing evidence changes what the reply can claim. An exception goes to the authorized person with the evidence they need.", objectives: ["2.3", "2.4"],
  },
  "market-bulletin": {
    station: "Bulletin editor", view: "document",
    opening: "The Friday draft tells vendors to arrive at the wrong time. I have their forms and the sheet I signed.",
    task: "Set the lines that will go into the two drafts and decide where to send them next.",
    references: [["Signed hours sheet · Friday", "Market opens 8:30. Deliveries must arrive by 8:00."], ["Vendor form V-17", "9:00 opening requested. Approval box empty."], ["Staff delivery note", "Open Dock B at 7:45. Staff copy needs the dock procedure. Inez approves publication."]],
    fields: [f("hours", "Public opening line", "9:00", "9:00", "8:30", "7:45"), f("cutoff", "Vendor delivery cutoff", "None", "None", "8:00", "8:30"), f("staff", "Put Dock B instructions in", "Both copies", "Both copies", "Staff copy", "Vendor copy"), f("send", "Next destination", "Publish", "Publish", "Inez’s desk", "Vendor inbox")],
    cases: [
      r("Vendor copy", "The public call needs the approved opening and delivery cutoff.", [["hours", "8:30"], ["cutoff", "8:00"]], "One of the two times is missing or differs from the signed sheet.", "Draft: Market opens 8:30. Deliveries by 8:00. The 9:00 request stays pending."),
      r("Staff copy", "Only staff need the rack and dock instructions.", [["staff", "Staff copy"]], "The vendor copy contains internal instructions or staff lost their procedure.", "Staff copy includes the Dock B procedure. Vendors see the times they need."),
    ],
    retest: r("Another form arrives before release", "V-21 requests a time change and has no signature.", [["send", "Inez’s desk"], ["hours", "8:30"]], "A draft can reach the public before Inez checks its sources.", "Both drafts sit in Inez’s tray with the current signed sheet. V-21 remains pending."),
    output: ({ hours, cutoff, staff, send }) => [
      ["Vendor draft", `Friday market opens at ${hours}.${cutoff === "None" ? "" : ` Deliver by ${cutoff}.`}${staff === "Staff copy" ? "" : "\nOpen Dock B at 7:45."}`],
      ["Staff draft", `Friday market opens at ${hours}.${staff === "Vendor copy" ? "" : "\nOpen Dock B at 7:45 before checking the delivery list."}\nNext: ${send}.`],
    ],
    debrief: "Prompt descriptions can specify audience and required fields. Source IDs, a completeness check and a publication gate make the instruction enforceable in a workflow.", objectives: ["1.1", "1.2", "2.1", "2.5", "4.4"],
  },
  "school-notice-pilot": {
    station: "Notice and intake desk", view: "document",
    opening: "The friendly rewrite lost the document checklist. Families now have to call us to find out what’s missing.",
    task: "Repair the outgoing notice and intake form, then compare the trial effort using the office log.",
    references: [["Signed checklist", "Bring proof of address and the student record. Tone may change; both documents are required."], ["Survey export", "30 weekday replies. Weekend families did not receive this round."], ["Shift notes", "Before: 12 min drafting + 2 review. After: 5 min drafting + 6 review. Staff corrected 2 of 30 replies."]],
    fields: [f("list", "Required documents in draft", "Student record", "Student record", "Address + record", "Leave blank"), f("scope", "Who the survey describes", "All families", "All families", "Weekday replies", "Weekend families"), f("form", "Submit with the date blank", "Allow", "Allow", "Ask for date", "Guess date"), q("net", "Net minutes saved per reply", 7, 0, 14, "min"), q("corrections", "Corrections to report", 0, 0, 30, "replies")],
    cases: [
      r("Notice preview", "The draft is friendly and mentions one of two documents.", [["list", "Address + record"], ["scope", "Weekday replies"]], "The preview is incomplete or makes a claim for families who were not surveyed.", "The friendly notice includes both documents and attributes its survey finding to weekday respondents."),
      r("Pilot board", "Review rose by four minutes while drafting fell by seven.", [["net", 3], ["corrections", 2]], "The board is missing a correction count or reports drafting speed as net effort.", "The board shows 3 minutes net saved per reply and 2 corrections out of 30."),
    ],
    retest: r("A form arrives with no date", "All other fields are complete. Referral rules remain in effect.", [["form", "Ask for date"]], "An incomplete date enters drafting as if it were confirmed.", "The form stays at intake and asks the family for the date."),
    output: ({ list, scope, net, corrections }) => [
      ["Family notice", `Please bring ${list === "Address + record" ? "proof of address and the student record" : list === "Leave blank" ? "[checklist missing]" : "the student record"}.\nSurvey scope: ${scope}.`],
      ["Pilot record", `${net} minutes net saved per reply × 30 replies = ${Number(net) * 30} minutes.\n${corrections} corrections recorded.`],
    ],
    debrief: "Evaluate iterations on total effort and output quality. An upstream validation step can remove rework while preserving the published policy and human review.", objectives: ["1.3", "2.2", "4.1", "4.3", "4.5"],
  },
  "library-activity-kit": {
    station: "Program kit table", view: "document",
    opening: "Last time the catalog imported an idea that the board hadn’t approved. Can you put the summer kit and import together?",
    task: "Assemble the staff kit. Keep the approved activities, optional ideas and machine import in their own places.",
    references: [["Signed minutes · June 4", "Paper Bridges P-18 and Shadow Theater S-26 approved. Rain plan pending."], ["Ideas whiteboard", "Rooftop astronomy R-31 proposed. The youth team asked for an indoor alternative."], ["Catalog contract", "Accepts an array of approved IDs only. Staff need an editable kit. The receiving team starts a fresh chat."], ["Model trial", "Quick labeled 18/20 routine forms in 12 s. Deep labeled 18/20 in 24 s. On conflicting minutes, Quick got 4/10 and Deep got 9/10. Minimums: 18 routine, 8 conflicting."]],
    fields: [f("kit", "Editable staff kit contains", "Rooftop astronomy", "Rooftop astronomy", "Bridges + Theater", "IDs only"), f("ideas", "Rooftop astronomy goes in", "Approved kit", "Approved kit", "Ideas tray", "Catalog import"), f("import", "Catalog payload", "P-18, S-26", "P-18, S-26", "[\"P-18\",\"S-26\"]", "[\"P-18\",\"R-31\"]"), f("routine", "Routine tagging trial", "Deep", "Deep", "Quick"), f("conflicts", "Conflicting minutes trial", "Quick", "Quick", "Deep"), f("handoff", "Attach to the fresh chat", "Entire brainstorm", "Entire brainstorm", "Dates + source IDs", "Nothing")],
    cases: [
      r("Staff kit preview", "Staff need material they can adapt. The new proposal is still open.", [["kit", "Bridges + Theater"], ["ideas", "Ideas tray"]], "The preview mixes proposed and approved work or leaves the staff without an editable kit.", "Editable kit: Paper Bridges and Shadow Theater. Rooftop astronomy appears in a separate ideas tray."),
      r("Catalog import", "The importer validates shape and compares each ID with the signed minutes.", [["import", "[\"P-18\",\"S-26\"]"]], "The catalog rejected the payload shape or an unapproved ID.", "The catalog accepted two approved program IDs."),
      r("Model trial", "Meet both accuracy minimums and use the quickest passing option for routine tagging.", [["routine", "Quick"], ["conflicts", "Deep"]], "The assignment spends extra time on routine tags or fails the conflict check.", "Quick meets the routine target with half the time. Deep meets the conflicting-minutes target."),
    ],
    retest: r("Another staff member starts the handoff", "They cannot see your earlier chat or its brainstorming.", [["handoff", "Dates + source IDs"]], "The new chat has no verified basis or inherits unrelated ideas.", "The new kit preview starts with the verified event dates and links to their records."),
    output: ({ kit, ideas, import: payload, handoff }) => [
      ["Staff kit", (kit === "Bridges + Theater" ? "Paper Bridges\nBuild a span between two tables and test how many counters it holds.\n\nShadow Theater\nPair children up to tell a story with paper silhouettes." : String(kit)) + `\n\nRooftop astronomy → ${ideas}\nHandoff → ${handoff}`],
      ["Catalog payload", String(payload)],
    ],
    debrief: "Use different output contracts for a person and a software consumer. Choose model capability from measured workload differences. Carry verified, source-linked facts across a fresh context while leaving ideation in its own workspace.", objectives: ["1.4", "2.6", "3.2", "3.4"],
  },
  "kitchen-billing-audit": {
    station: "Refund ledger", view: "document",
    opening: "A customer refunded last week appears as a new sale. The supplier changed the export Tuesday.",
    task: "Compare the same order in both files, change the rule and verify the next summary.",
    references: [["Export A · order 27", "amount = −18.40, no type field"], ["Export B · order 27", "amount = 18.40, type = R"], ["Bookkeeper correction", "R is a refund in export B. Type S remains a sale. The old negative-only rule was retired."], ["Cost trial", "The lower-cost route met the routine accuracy requirement. Requests flagged as ambiguous need a staff review."]],
    fields: [f("classify", "Mark as refund when", "Amount < 0", "Amount < 0", "Type R", "Any positive amount"), f("measure", "Summary entry for order 27", "Sale +18.40", "Sale +18.40", "Refund −18.40", "Omit"), f("store", "Save the reviewed rule to", "This chat", "This chat", "Shared template", "One staff note"), f("routine", "Routine processing", "High-cost route", "High-cost route", "Lower-cost route"), f("ambiguous", "Flagged record", "Post immediately", "Post immediately", "Staff review")],
    cases: [
      r("Weekly ledger", "Order 27 uses the new type field.", [["classify", "Type R"], ["measure", "Refund −18.40"]], "Order 27 is still counted as a sale or omitted from the summary.", "Order 27 contributes −18.40 with its original export evidence."),
      r("Next shift", "Another clerk opens a new chat for the weekly summary.", [["store", "Shared template"]], "The correction stays inside one conversation or one person’s notes.", "The next shift can load the reviewed, shared refund rule."),
    ],
    retest: r("Next export · orders 41 and 43", "41: amount = 7.25, type = S. 43: the type field is smudged and flagged as ambiguous.", [["classify", "Type R"], ["routine", "Lower-cost route"], ["ambiguous", "Staff review"]], "The workflow misclassifies a positive field, spends more than necessary on routine work, or posts an uncertain record.", "Order 41 posts through the lower-cost route. Order 43 waits for staff with the source attached."),
    output: ({ classify, measure, store }) => [
      ["Order 27 · export to ledger", `Source A: −18.40\nSource B: +18.40 · R\nCurrent refund rule: ${classify}\nWeekly ledger: ${measure}\nRule stored in: ${store}`],
    ],
    debrief: "Hold the model and prompt steady while comparing matched inputs to diagnose a source change. Use measured quality and ambiguity to choose a processing route. A versioned shared instruction lets another operator reproduce the correction.", objectives: ["3.3", "7.1", "7.2", "7.3"],
  },
  "community-policy": {
    station: "Application sorting desk", view: "document",
    opening: "Applications are waiting for dates. I can share themes with the analysis team if we leave personal details here.",
    task: "Prepare a safe outgoing packet and decide what a staff member still needs to do.",
    references: [["Queue log", "Complete forms take a day. Missing-date forms take two days. Drafting takes ten minutes."], ["Sample A17", "Address: 8 Birch. Medical detail: included. Topic: weekend training. Date: blank."], ["Program policy", "Only staff award a slot. Share only topic-bearing material in the approved workspace. Ask the mailbox owner for written permission covering this purpose before connecting."]],
    fields: [f("address", "Address in analysis packet", "Include", "Include", "Remove"), f("medical", "Medical detail in analysis packet", "Include", "Include", "Remove"), f("topic", "Topic in analysis packet", "Remove", "Remove", "Keep"), f("date", "Blank date at intake", "Draft anyway", "Draft anyway", "Ask applicant", "Guess"), f("mail", "Connect the mailbox after", "Login works", "Login works", "Written permission"), f("award", "Award decision", "Assistant", "Assistant", "Staff", "First reply")],
    cases: [
      r("Outgoing packet A17", "The analysis team only needs the topic and the mailbox owner has yet to respond.", [["address", "Remove"], ["medical", "Remove"], ["topic", "Keep"], ["mail", "Written permission"]], "The packet carries restricted details, lacks its topic, or tries a connection before authorization.", "The packet has the topic only. Its mailbox connection waits for the owner’s written approval."),
      r("The missing-date queue", "A seventeen-minute draft still has no date to work from.", [["date", "Ask applicant"]], "The application reaches drafting with the field still missing.", "Intake sends a date request before draft or referral."),
    ],
    retest: r("A second applicant sounds very confident", "Both candidates want the last slot. Their wording is not a program criterion.", [["award", "Staff"]], "The assistant or response speed decides a limited award.", "Staff receive the cited applications and record the award decision."),
    output: ({ address, medical, topic }) => [
      ["Outgoing packet A17", [
        ...(address === "Include" ? ["Address: 8 Birch."] : []),
        ...(medical === "Include" ? ["Medical detail: synthetic report attached."] : []),
        ...(topic === "Keep" ? ["Topic: weekend training."] : []),
      ].join("\n") || "Packet has no content."],
    ],
    debrief: "Apply data minimization before transfer and request access for the intended purpose. A workflow can organize evidence and preserve accountable decisions. Compare group outcomes using the actual service criteria.", objectives: ["4.2", "6.1", "6.2", "6.3", "6.4"],
  },
} satisfies Record<string, Casework>;
