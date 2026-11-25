// Study reminder emails are chosen in SQL (certcity_private.notification_candidates) from progress the app saves.
// The SQL hard-codes each track's hands-on lab IDs, so it silently stops sending when a lab is replaced.
// This check keeps the SQL, the email copy and the app's own lab definitions and anchors in step.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = (module, file) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  module._compile(outputText, file);
};

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const { tracks } = require("../lib/claude/blueprints.ts");
const { decemberBlueprint, decemberVersion } = require("../lib/claude/december-blueprints.ts");
const { getCapstoneDefinition } = require("../lib/claude/capstones/index.ts");
const { notificationEmail } = require("../supabase/functions/notifications/email.ts");

// The migration applied last wins, so read the newest definition of the candidate query.
const migrations = fs.readdirSync(path.join(root, "supabase/migrations")).filter((name) => name.endsWith(".sql")).sort();
const latest = migrations.filter((name) => /function certcity_private\.notification_candidates\(/.test(read(`supabase/migrations/${name}`))).at(-1);
assert.ok(latest, "No migration defines certcity_private.notification_candidates");
const sql = read(`supabase/migrations/${latest}`);
const rows = [...sql.matchAll(/\('([a-z-]+)', '([A-Z-]+)', '([a-z0-9-]+)', '([a-z0-9-]+)', '([a-z0-9-]+)'\)/g)]
  .map(([, trackId, code, guide, capstone, transfer]) => ({ trackId, code, guide, capstone, transfer }));

const expected = tracks.flatMap((track) => ["july-2026", ...(decemberBlueprint(track) ? [decemberVersion] : [])].map((guide) => ({
  trackId: track.id, code: track.code, guide,
  capstone: getCapstoneDefinition(track.id, guide, "capstone").id,
  transfer: getCapstoneDefinition(track.id, guide, "transfer").id,
})));
const key = ({ trackId, guide }) => `${trackId}/${guide}`;
assert.deepEqual(rows.map(key).sort(), expected.map(key).sort(), `${latest}: reminder guides do not match the tracks and guides the app offers`);
for (const entry of expected) {
  assert.deepEqual(rows.find((row) => key(row) === key(entry)), entry,
    `${latest}: ${key(entry)} must remind on the current hands-on lab (${entry.capstone} → ${entry.transfer})`);
}
// Both 7-day reminders open 7 days after the activity, as lib/claude/practice.ts and lib/claude/capstones do.
assert.match(sql, /interval '168 hours'/, `${latest}: reminders must open 168 hours after the activity`);

// Every reminder renders, names the step the way the app does and links to an anchor the app renders.
const site = new URL("https://certcity.org");
const project = new URL("https://example.supabase.co");
const base = { delivery_id: "00000000-0000-4000-8000-000000000000", attempts: 1, recipient: "learner@example.invalid", due_at: "2026-11-25T10:00:00Z", signup_email: null };
const anchors = {
  "#practice-followup": read("components/academy/workspace.tsx"),
  "#track-practicals": read("components/academy/capstone-workspace.tsx"),
  "#study-email": read("components/study-email-preferences.tsx"),
};
for (const entry of expected) {
  for (const [kind, step, anchor] of [["academy_followup", "7-day review is ready", "#practice-followup"], ["academy_practical", "7-day review lab is open", "#track-practicals"]]) {
    const email = notificationEmail({ ...base, kind, track_id: entry.trackId, guide: entry.guide }, site, project);
    assert.equal(email.to, base.recipient);
    assert.match(email.subject, new RegExp(step), `${kind} subject must use the app's wording`);
    assert.ok(email.text.includes(`${site.origin}/certifications/${entry.trackId}?guide=${entry.guide}${anchor}`), `${kind} must link to ${anchor}`);
    assert.ok(email.text.includes(`${site.origin}/help#study-email`), `${kind} must link to the reminder setting`);
  }
}
const dispatch = notificationEmail({ ...base, kind: "dispatch_followup", track_id: "architect-foundations", guide: null }, site, project);
assert.match(dispatch.subject, /7-day review is ready/);
assert.ok(dispatch.text.includes("mission=dispatch-lookup&study=followup"));
for (const [anchor, source] of Object.entries(anchors)) {
  assert.ok(source.includes(`id="${anchor.slice(1)}"`), `Reminder links to ${anchor}, which the app no longer renders`);
}
assert.throws(() => notificationEmail({ ...base, kind: "academy_followup", track_id: "unknown-track", guide: "july-2026" }, site, project));
assert.throws(() => notificationEmail({ ...base, kind: "academy_followup", track_id: "associate-foundations", guide: "july-2026", recipient: null }, site, project));
const signup = notificationEmail({ ...base, kind: "account_signup", recipient: null, track_id: null, guide: null, signup_email: "new@example.invalid" }, site, project);
assert.ok(signup.text.includes("new@example.invalid") && signup.to !== "new@example.invalid", "Account alerts go to CertCity, not the learner");
const reports = notificationEmail({ ...base, kind: "question_reports", recipient: null, track_id: null, guide: null }, site, project);
assert.ok(reports.text.includes("09:00 UTC and 2026-11-25 10:00 UTC") && reports.text.includes("/project/example/"));

console.log(`Notification reminders match ${expected.length} track guides (${latest}) and render with live links.`);
