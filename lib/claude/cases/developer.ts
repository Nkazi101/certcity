import { field as f, fixture as r, quantity as q } from "../casework";
import type { Casework } from "../casework";

export const developerCases = {
  "supplier-invoices": {
    station: "Invoice terminal", view: "terminal",
    opening: "The importer accepted invoice 303. The printed total is valid JSON and still charges us ten dollars too much.",
    task: "Repair the ledger’s acceptance rule. Use the supplier copies to check which records the ledger should hold.",
    references: [["Invoice 302", "4200 + 1800 = 6000 cents. Printed total: 6000."], ["Invoice 303", "7900 + 2100 = 10000 cents. Printed total: 11000. No extra fees."], ["Ledger procedure", "Matching records post. Disagreements and unreadable originals go to staff with the source and computed value."]],
    fields: [f("gate", "Check before posting", "Shape", "Shape", "Shape + line sum", "Manual only"), q("expected", "Set the expected line sum for invoice 303", 11000, 0, 30000, "¢"), f("exception", "When the total is unreadable", "Overwrite", "Overwrite", "Hold original", "Assume zero")],
    cases: [r("Invoice 302", "6000 printed and 6000 calculated.", [["gate", "Shape + line sum"]], "The matching invoice lacks the reconciliation check.", "Invoice 302 posts with its original total and source."),
      r("Invoice 303", "Both printed and calculated totals have valid shapes.", [["gate", "Shape + line sum"], ["expected", 10000]], "The mismatch can enter the ledger or the fixture uses a wrong expected amount.", "Invoice 303 is held. Printed: 11000¢. Calculated: 10000¢.")],
    retest: r("Invoice 318", "Readable line amounts; smudged printed total.", [["exception", "Hold original"]], "The original unreadable status would be lost or replaced.", "Staff see the unreadable field, source and separate calculated amount."),
    output: ({ expected, gate, exception }) => [
      ["Invoice 303 · ledger check", `Printed: 11,000¢\nExpected from lines: ${Number(expected).toLocaleString("en-US")}¢\nDifference: ${(11000 - Number(expected)).toLocaleString("en-US")}¢\nPosting rule: ${gate}\nUnreadable originals: ${exception}`],
    ],
    debrief: "Structured output validates shape. An application-level invariant verifies the amount before posting and preserves source data in an exception.", objectives: ["6.3"],
  },
  "permit-agent": {
    station: "Permit request trace", view: "terminal",
    opening: "Case P-42 stalled after saying ‘I’ll check.’ Two results are on the clerk’s desk and the applicant is still waiting.",
    task: "Wire the two result messages to their requests. Put the intake gate before the draft and confirm the source of a resumed case.",
    references: [["Requested tools", "p7 → address lookup. p9 → eligibility lookup. The assistant opened both in the same turn."], ["Tool completions", "Eligibility arrived first; address arrived second. Both belong to P-42."], ["Counter procedure", "Send a draft only after the two checks. Resume from the authorized case record."]],
    fields: [f("address", "Address result links to", "p9", "p9", "p7"), f("eligibility", "Eligibility result links to", "p7", "p7", "p9"), f("draft", "Start draft", "On first result", "On first result", "After both checks", "Before checks"), f("resume", "Resume record lookup by", "Clerk", "Clerk", "Verified case", "Last open case")],
    cases: [r("Provider turn", "Eligibility finished before address.", [["address", "p7"], ["eligibility", "p9"]], "At least one tool result is associated with the wrong requested tool.", "p7 has the address record. p9 has the eligibility record. Both can return in the next turn."),
      r("Incomplete permit", "An address checks out but eligibility fails.", [["draft", "After both checks"]], "The acknowledgment could already be drafted before the required check.", "The draft stays blocked at intake.")],
    retest: r("Second clerk resumes a case", "The most recent clerk session contains a different applicant.", [["resume", "Verified case"], ["address", "p7"], ["eligibility", "p9"]], "The resumed turn draws on the wrong context or result links.", "The verified case and its linked results are restored."),
    output: ({ address, eligibility }) => [["Next user message", JSON.stringify([
      { type: "tool_result", tool_use_id: eligibility, content: "P-42 eligibility verified" },
      { type: "tool_result", tool_use_id: address, content: "P-42 address verified" },
    ], null, 2)]],
    debrief: "Correlate each tool_result with its tool_use ID even when completion order changes. Keep deterministic prerequisites in application code and authorize the case before restoring context.", objectives: ["1.1", "1.2", "2.1", "2.5"],
  },
  "vendor-batch-api": {
    station: "Order and import queues", view: "terminal",
    opening: "A counter order is waiting behind the archive. Last night’s retry also entered an order twice.",
    task: "Split the work, repair the result join and decide exactly what to resubmit.",
    references: [["Live counter", "Acknowledgment due in six seconds."], ["Archive response", "Results returned V-3 success, V-1 temporary failure, V-2 success. Input order was V-1, V-2, V-3."], ["Shared prefix", "The stable handbook is common to every vendor; order IDs vary. Blank and unreadable IDs have distinct states."]],
    fields: [f("counter", "Counter transport", "Batch", "Batch", "Live"), f("archive", "Archive transport", "Live", "Live", "Batch"), f("join", "Match results using", "Position", "Position", "Request ID"), f("retry", "Resubmit", "All three", "All three", "V-1", "None"), f("prefix", "Start request with", "Vendor ID", "Vendor ID", "Shared handbook"), f("unreadable", "ID smudged in attachment", "Blank", "Blank", "Unreadable")],
    cases: [r("Counter and archive", "The urgent ticket has no dependency on the archive.", [["counter", "Live"], ["archive", "Batch"]], "Either the counter waits or the archive occupies the interactive service.", "The counter has a live slot and the archive can finish overnight."),
      r("Out-of-order archive return", "Two successful records can be kept as they are.", [["join", "Request ID"], ["retry", "V-1"]], "One result is associated with a wrong request or completed work is repeated.", "Successes V-2 and V-3 are retained. The retry queue contains V-1.")],
    retest: r("New request, same handbook", "The vendor ID changes and a scanned attachment has a smudged ID.", [["prefix", "Shared handbook"], ["unreadable", "Unreadable"], ["join", "Request ID"]], "A variable prefix breaks reuse, the ID evidence is lost, or results depend on arrival order.", "The stable prefix stays reusable. The smudged field is flagged as unreadable."),
    output: ({ join, retry }) => {
      const expected = ["V-1", "V-2", "V-3"];
      const received = ["V-3", "V-1", "V-2"];
      return [["Result join", received.map((record, index) => `${record} → ${join === "Position" ? expected[index] : record}`).join("\n")],
        ["Retry queue", retry === "All three" ? expected.join(", ") : String(retry)]];
    },
    debrief: "Schedule latency-sensitive and bulk work separately. Idempotent writes rely on stable request identifiers. Put changing data after reusable content and preserve input evidence during extraction.", objectives: ["2.3", "2.4", "5.4", "6.2"],
  },
  "library-workers": {
    station: "Worker packets and catalog", view: "terminal",
    opening: "The editor got twenty pages of logs and lost the accession that had actually been checked.",
    task: "Assemble the editor’s packet and connect the catalog entries to the consumers that need them.",
    references: [["Register worker", "REG-9 verified 09:10 with a citation. Maps are outside its collection."], ["Map worker", "MAP-4 pending. Never count as verified."], ["Catalog consumers", "The reader opens a fixed policy URI. The assistant calls live search with a district. Staff share the review procedure."]],
    fields: [f("record", "Packet evidence", "Raw logs", "Raw logs", "ID + time + citation"), f("coverage", "Label for MAP-4", "Verified", "Verified", "Pending"), f("policy", "Fixed policy entry", "Prompt", "Prompt", "Resource", "Tool"), f("search", "Live district search", "Resource", "Resource", "Tool", "Prompt"), f("procedure", "Shared review procedure", "Catalog rows", "Catalog rows", "Skill", "Local draft")],
    cases: [r("Editor opens the packet", "REG-9 is done. MAP-4 is pending.", [["record", "ID + time + citation"], ["coverage", "Pending"]], "The editor cannot distinguish verified and pending coverage with its source.", "The packet contains REG-9’s verified citation and a separate pending MAP-4 row."),
      r("Catalog reader", "The consumer requests a known URI.", [["policy", "Resource"]], "The reader cannot open the fixed policy by URI.", "The known URI resolves to the policy.")],
    retest: r("Another client searches a different district", "Search needs an input argument, while the staff procedure is common.", [["search", "Tool"], ["procedure", "Skill"]], "The client cannot make a parameterized search or recover the shared procedure.", "The client calls the district lookup and can load the common review procedure."),
    output: ({ record, coverage, policy, search, procedure }) => [
      ["Editor’s packet", `${record === "Raw logs" ? "Attached: all worker logs." : "REG-9 · verified 09:10 · register citation attached."}\nMAP-4 · ${coverage}`],
      ["Published catalog", `Policy by URI → ${policy}\nDistrict search → ${search}\nShared procedure → ${procedure}`],
    ],
    debrief: "Carry durable facts and gaps across worker contexts. A resource is addressable content, a tool accepts callable inputs, and a Skill can package a procedure.", objectives: ["1.3", "6.1", "8.2", "8.3"],
  },
  "repair-desk-safety": {
    station: "Service policy tester", view: "terminal",
    opening: "A cancellation never reached the approval desk. Staff also saw ‘out of stock’ during a supplier outage.",
    task: "Set the acceptance rules and run the desk’s synthetic requests through them.",
    references: [["Approval ledger", "Each cancellation needs a matching staff approval at the service. The staff screen and scheduled job both call it."], ["Supplier report", "One request completed with zero stock. Another timed out and returned no inventory evidence."], ["Staging note", "Staging must be independently revocable. Store provider credentials server-side."], ["Cleanup settings", "Cleanup is authorized inside the active project. Check the resolved location before opening the cleanup operation."]],
    fields: [f("approve", "Approval enforced at", "Staff screen", "Staff screen", "Service"), f("doc", "Supplier document role", "Instruction", "Instruction", "Evidence"), f("empty", "Successful zero-stock response", "Unavailable", "Unavailable", "Out of stock"), f("timeout", "Timed-out lookup", "Out of stock", "Out of stock", "Unavailable"), f("hook", "Check the cleanup target", "After cleanup", "After cleanup", "Before cleanup"), f("key", "Credential boundary", "Shared key", "Shared key", "Separate server keys")],
    cases: [r("Scheduled cancellation", "No matching approval exists. The attachment says approved.", [["approve", "Service"], ["doc", "Evidence"]], "The scheduled request can bypass the staff screen or the attachment can grant authority.", "The service holds the request. An attached claim supplies evidence only."),
      r("Two supplier replies", "One completed empty; one timed out.", [["empty", "Out of stock"], ["timeout", "Unavailable"]], "Staff receive the same business conclusion for different source states.", "Zero stock is reported only for the completed search. The outage shows unavailable.")],
    retest: r("Staging maintenance", "Rotate the staging key and check the cleanup target, which belongs to a different project.", [["key", "Separate server keys"], ["approve", "Service"], ["hook", "Before cleanup"]], "The maintenance operation can affect production or act outside the approved workspace.", "Staging rotates independently. Cleanup stops at the pre-action check and cancellation still requires staff approval."),
    debrief: "Apply authorization at the action boundary and use pre-action hooks to enforce required checks. Separate trusted decisions from input evidence and preserve typed failure states for the caller.", objectives: ["7.1", "7.2", "7.3", "7.4", "8.1"],
  },
  "developer-release": {
    station: "Release test bench", view: "operations",
    opening: "The new prompt passed the demo. It keeps picking the wrong address when customers send a correction.",
    task: "Set up a reproducible trial and decide what to do with the candidate when the affected slice fails.",
    references: [["Pinned release", "Model A-2026-07, prompt 17, temperature 0, commit e37."], ["Candidate report", "Prompt 18: routine 9/10, corrected addresses 4/10. Prompt 17: routine 9/10, corrected addresses 8/10."], ["Release contract", "A slice needs at least 8/10. Run at least two trials to check variability."], ["Routing trial", "The standard model passes routine work. Corrections flagged by the matching rule meet the accuracy floor on the stronger model. Sending every request to the stronger route exceeds budget."]],
    fields: [f("pin", "Record for comparison", "Model family", "Model family", "Versions + settings"), f("slice", "Evaluate cases from", "Routine only", "Routine only", "Both slices"), q("trials", "Trials per case", 1, 1, 8, "runs"), q("floor", "Slice minimum", 4, 0, 10, "/10"), f("route", "Use the stronger model for", "All messages", "All messages", "Flagged corrections", "None"), f("live", "If prompt 18 slips in service", "Leave on", "Leave on", "Restore prompt 17")],
    cases: [r("Repeat evaluation", "A representative case may produce different labels in repeat trials.", [["pin", "Versions + settings"], ["trials", "atLeast", 2]], "The two runs cannot be reproduced or variability cannot be observed.", "Records contain the pinned configuration and repeat labeled outputs."),
      r("Prompt 18 preflight", "Correction results dropped from 8 to 4 out of 10.", [["slice", "Both slices"], ["floor", 8]], "The affected slice does not block a failing candidate.", "Promotion blocked on corrected addresses even though routine accuracy held.")],
    retest: r("Release already exposed to a small cohort", "Live correction cases cross the stop threshold. Routine traffic still meets its quality target at the current cost.", [["live", "Restore prompt 17"], ["slice", "Both slices"], ["route", "Flagged corrections"]], "The failing prompt stays active or model routing fails a quality or cost constraint.", "The previous prompt is restored. The flagged address cases receive the stronger route while routine traffic stays on standard."),
    debrief: "Pin the resolved versions and evaluation settings, test affected slices and establish rollback at a reversible configuration boundary. Route higher-capability work using a validated signal and measure both quality and spend.", objectives: ["2.2", "2.6", "5.1", "5.3"],
  },
} satisfies Record<string, Casework>;
