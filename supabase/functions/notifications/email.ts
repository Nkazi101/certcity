export const contactEmail = "info@certcity.org";
export const notificationSender = "CertCity <study@notifications.certcity.org>";

const trackNames: Record<string, string> = {
  "associate-foundations": "Associate Foundations",
  "developer-foundations": "Developer Foundations",
  "architect-foundations": "Architect Foundations",
  "architect-professional": "Architect Professional",
};

export type Notification = {
  delivery_id: string;
  attempts: number;
  recipient: string | null;
  kind: "academy_followup" | "academy_practical" | "dispatch_followup" | "question_reports" | "account_signup";
  track_id: string | null;
  guide: "july-2026" | "december-2026" | null;
  due_at: string;
  signup_email: string | null;
};

export function notificationEmail(job: Notification, site: URL, projectUrl: URL) {
  if (job.kind === "account_signup") {
    if (!job.signup_email) throw new Error("Account alert has no verified email");
    return {
      to: contactEmail,
      subject: "New CertCity account",
      text: `A learner created an account and verified their email address.\n\nAccount email: ${job.signup_email}\nVerified at: ${new Date(job.due_at).toISOString()}`,
    };
  }
  if (job.kind === "question_reports") {
    const end = new Date(job.due_at);
    const start = new Date(end.getTime() - 3_600_000);
    const hour = (date: Date) => date.toISOString().slice(0, 16).replace("T", " ") + " UTC";
    const dashboard = new URL(`/dashboard/project/${projectUrl.hostname.split(".")[0]}/editor`, "https://supabase.com");
    return {
      to: contactEmail,
      subject: "New CertCity practice question reports",
      text: `CertCity received practice question reports between ${hour(start)} and ${hour(end)}.\n\nReview the practice_item_reports table in Supabase. Each report includes the question ID, exam guide, content revision and learner's note.\n${dashboard.href}`,
    };
  }

  if (!job.recipient) throw new Error("Study reminder has no recipient");
  let subject = "Your City Dispatch follow-up is ready";
  let body = "You can now apply your City Dispatch skills to a new scenario at an arts center.";
  let link = new URL("/?pathway=architect-foundations&mission=dispatch-lookup&study=followup", site);
  if (job.kind !== "dispatch_followup") {
    const name = job.track_id ? trackNames[job.track_id] : undefined;
    if (!name || !job.guide) throw new Error("Study reminder has no matching guide");
    const practical = job.kind === "academy_practical";
    subject = practical ? `Your next ${name} practical case is ready` : `Your ${name} practice follow-up is ready`;
    body = practical
      ? "A new practical case opened after your first case. Try the same skills in a different setting."
      : "A fresh set of questions is ready after your mixed practice session.";
    link = new URL(`/certifications/${job.track_id}?guide=${job.guide}${practical ? "#track-practicals" : "#practice-followup"}`, site);
  }
  return {
    to: job.recipient,
    subject,
    text: `${body}\n\nContinue studying\n${link.href}\n\nManage study email reminders\n${new URL("/help#study-email", site).href}`,
  };
}

export async function sendNotification(key: string, job: Notification, site: URL, projectUrl: URL) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `certcity/${job.delivery_id}`,
    },
    body: JSON.stringify({ ...notificationEmail(job, site, projectUrl), from: notificationSender, reply_to: contactEmail }),
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Resend HTTP ${response.status}`);
  }
  const sent = await response.json();
  if (typeof sent?.id !== "string" || !sent.id) throw new Error("Resend did not return an email ID");
  return sent.id as string;
}
