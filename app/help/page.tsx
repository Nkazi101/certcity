import Link from "next/link";
import { AcademyHeader } from "../../components/academy/chrome";
import { ProgressRecovery } from "../../components/progress-recovery";
import { StudyEmailPreferences } from "../../components/study-email-preferences";
import { certificationCatalog, helpPage, pageMetadata } from "../../lib/seo";

export const metadata = pageMetadata(helpPage);

export default function StudyHelp() {
  return <div className="academy-shell">
    <AcademyHeader current="help" />
    <main id="academy-main" tabIndex={-1} className="academy-width academy-workspace">
      <header className="academy-workspace-title">
        <h1>{helpPage.title}</h1>
        <p>Keep a backup, recover work, or help us review a question from <Link href={certificationCatalog.path}>Claude exam practice</Link>.</p>
      </header>
      <ProgressRecovery />
      <StudyEmailPreferences />
      <section className="academy-panel">
        <h2>Report a practice question</h2>
        <p>Every question you answer has a Report this question link once you’ve seen its answer: practice exams and domain retests after you submit, the questions after each city mission, a shift’s closing questions and the exam guide decisions. CertCity includes the item and the guide so a reviewer can find your exact version.</p>
      </section>
      <section className="academy-panel">
        <h2>Work without the 3D view</h2>
        <p>Use Places or Missions to reach a mission with the keyboard. Select a listed resident, mission file, or work area to open the same controls and feedback.</p>
      </section>
      <section className="academy-panel">
        <h2>Contact CertCity</h2>
        <p>For help with CertCity, email <a href="mailto:info@certcity.org">info@certcity.org</a>.</p>
      </section>
    </main>
  </div>;
}
