import type { CityAssignmentId } from "./claude/assignments";

export const introductions: Record<CityAssignmentId, { portrait: string; greeting: string; evidence: string; question: string }> = {
  "associate-foundations": {
    portrait: "jordan",
    greeting: "Hi, I’m Jordan. The front office has three families waiting for an answer. Could you take a look before we send anything?",
    evidence: "I pulled the current bulletin and last year’s sample. One reopening date is still pending, and only our enrollment lead can make an exception.",
    question: "Tell me how you’d handle each message. We’ll try your replies against the bulletin before staff send them.",
  },
  "developer-foundations": {
    portrait: "lina",
    greeting: "I’m Lina. One of this morning’s invoices made it through our importer even though the total was wrong. Can you help before I close the books?",
    evidence: "I kept all three invoices. One adds up, one has a printed total that disagrees with its lines, and one total is unreadable.",
    question: "What should the importer check, and what should it do when the numbers don’t agree? We can replay the same invoices to see what reaches the ledger.",
  },
  "architect-professional": {
    portrait: "priya",
    greeting: "I’m Priya. We’ve been asked to pilot a support assistant. I have two candidates and a day’s worth of test tickets.",
    evidence: "Operations set a latency target. Finance set a cost ceiling. Support has the final say on disputes.",
    question: "Which candidate and dispute control would you put in the pilot? Let’s replay those tickets and compare the result with the release conditions.",
  },
};

export const dispatchConversation = [
  { name: "Nia Brooks", role: "Customer support lead", portrait: "nia", question: "What happened to the shipment?",
    line: "A customer gave us tracking number T-17. We told them their shipment didn’t exist, and now they’re on the callback bench. Can you find out what the lookup actually returned? I’d repair the lookup before working a counter shift, but the counter’s open whenever you want it." },
  { name: "Arun Mehta", role: "Integration engineer", portrait: "arun", question: "Can I see what the lookup returned?",
    line: "Here’s T-17. The gateway recorded a timeout, but the customer saw the same reply we send when a search finishes with zero rows. The lookup is read-only, so we can test a recovery rule on the same ticket." },
  { name: "Jo Rivera", role: "Operations lead", portrait: "jo", question: "What should a good replay week look like?",
    line: "Get false ‘order not found’ replies to zero and reduce staff follow-up. Keep access rules in place. You can replay the ticket, change the recovery rules, then compare the full replay week." },
] as const;

export const previewConversations = {
  "olive-library": {
    portrait: "nolan",
    greeting: "I’m Nolan. We’re preparing a photo exhibit on Olive Street. The printed catalog and the handwritten notes don’t always agree on where a picture was taken.",
    evidence: "A useful record includes its source and date. If one collection is unavailable, we still need to tell visitors what the other collections established.",
  },
  "olive-cafe": {
    portrait: "micah",
    greeting: "Hi, I’m Micah. The lunch line is picking up, and we’ve got supplier notes mixed in with customer orders.",
    evidence: "We handle allergy questions separately so the kitchen can give each one a proper answer. Supplier messages can wait until we’ve cleared the line.",
  },
} as const;
