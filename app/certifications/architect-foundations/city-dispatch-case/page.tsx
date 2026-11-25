import Link from "next/link";
import { AcademyHeader, ExternalLink } from "../../../../components/academy/chrome";
import { SeoBreadcrumbs } from "../../../../components/academy/seo-breadcrumbs";
import { cityAssignmentHref, trackHref, trackPracticeHref, tracks } from "../../../../lib/claude/blueprints";
import { baselineShift, runShift, sampleTicket, traceOutcome } from "../../../../lib/shift";
import type { Routes } from "../../../../lib/shift";
import { certificationCatalog, dispatchCasePage, methodologyPage, pageMetadata, siteName } from "../../../../lib/seo";

export const metadata = pageMetadata(dispatchCasePage);

const track = tracks.find(({ id }) => id === "architect-foundations")!;
const examplePolicy: Routes = { empty: "noMatch", timeout: "retry", invalid: "clarify", denied: "deny" };
const replay = runShift("typed", examplePolicy);
const outcome = traceOutcome("typed", examplePolicy);
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default function CityDispatchCase() {
  return <div className="academy-shell">
    <AcademyHeader />
    <main id="academy-main" tabIndex={-1} className="academy-width academy-workspace academy-editorial academy-article">
      <SeoBreadcrumbs entries={[{ name: siteName, path: "/" }, { name: "Claude exam practice", path: certificationCatalog.path }, { name: "Architect Foundations", path: trackHref(track) }, { name: "City Dispatch mission", path: dispatchCasePage.path }]} />
      <header className="academy-workspace-title">
        <h1>City Dispatch mission: Claude tool reliability walkthrough</h1>
        <p>An original Architect Foundations practice mission. Diagnose a misleading order lookup, give the tool distinct outcomes, then compare how the policy handles the same simulated workload.</p>
      </header>
      <section className="academy-panel">
        <h2>Read the failed lookup</h2>
        <p>On ticket {sampleTicket.id}, a customer requests shipment status. The lookup gateway returns <code>{sampleTicket.code}</code> before it produces rows. The original assistant replies “Order not found.”</p>
        <p>A completed lookup with no rows supports an empty result. A timeout leaves the shipment status unknown. The contract needs to preserve that difference for the caller.</p>
      </section>
      <section className="academy-panel">
        <h2>Route each outcome</h2>
        <table className="academy-editorial-table">
          <thead><tr><th scope="col">Observed result</th><th scope="col">Policy decision</th></tr></thead>
          <tbody>
            <tr><th scope="row">Completed with no matches</th><td>Report that the completed lookup found no match.</td></tr>
            <tr><th scope="row">Temporary timeout</th><td>Retry once if the request allows it. Hand off unresolved work with the timeout context.</td></tr>
            <tr><th scope="row">Invalid order ID</th><td>Ask the customer for a corrected identifier.</td></tr>
            <tr><th scope="row">Permission denied</th><td>Deny safely without disclosing restricted details.</td></tr>
          </tbody>
        </table>
        <p>On ticket {sampleTicket.id}, the fixture’s retry succeeds. {outcome.disposition}.</p>
      </section>
      <section className="academy-panel">
        <h2>Compare the same 1,000 simulated requests</h2>
        <table className="academy-editorial-table">
          <thead><tr><th scope="col">Measure</th><th scope="col">Single fallback</th><th scope="col">Route by outcome</th></tr></thead>
          <tbody>
            <tr><th scope="row">False no-match replies</th><td>{baselineShift.falseNoMatches}</td><td>{replay.falseNoMatches}</td></tr>
            <tr><th scope="row">Staff follow-up</th><td>{baselineShift.staffHours} hours</td><td>{replay.staffHours} hours</td></tr>
            <tr><th scope="row">Lookup calls</th><td>{baselineShift.calls.toLocaleString("en-US")}</td><td>{replay.calls.toLocaleString("en-US")}</td></tr>
            <tr><th scope="row">Direct operating spend</th><td>{currency.format(baselineShift.directSpend)}</td><td>{currency.format(replay.directSpend)}</td></tr>
          </tbody>
        </table>
        <p>The figures come from CertCity’s simulation. Typed routing avoids false replies and reduces staff follow-up in this fixture. It uses more lookup calls and increases simulated direct spend.</p>
        <div className="academy-actions">
          <Link className="academy-button primary" prefetch={false} href={`${cityAssignmentHref(track)}&mission=dispatch-lookup`}>Try the City Dispatch mission</Link>
          <a className="academy-button secondary" href={`${trackPracticeHref(track)}#rehearsal`}>Open timed exam practice</a>
        </div>
      </section>
      <section className="academy-panel academy-official">
        <h2>Connect the mission to the exam</h2>
        <p>Use the debrief to practice structured tool errors and recovering from uncertain results.</p>
        <ExternalLink href={track.guide}>Official Architect Foundations exam guide</ExternalLink>
        <Link href={`${methodologyPage.path}#${track.id}`}>Architect Foundations objective map</Link>
      </section>
    </main>
  </div>;
}
