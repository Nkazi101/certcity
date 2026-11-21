import { ArrowLeft, ArrowUpRight, CodeXml, Compass, Layers3, UsersRound } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { partnerCatalog, partnerFAQ, pearson } from "../../lib/claude/blueprints";
import type { TrackId } from "../../lib/claude/blueprints";
import { AccountButton } from "../account";

export const trackIcons = {
  "associate-foundations": UsersRound,
  "developer-foundations": CodeXml,
  "architect-foundations": Layers3,
  "architect-professional": Compass,
} satisfies Record<TrackId, typeof Compass>;

export function AcademyHeader() {
  return (
    <header className="academy-header">
      <div className="academy-width academy-header-inner">
        <Link className="academy-wordmark" href="/" prefetch={false} aria-label="CertCity home">
          <img src="/brand/wordmark-primary.svg" width={2000} height={545} alt="" />
        </Link>
        <div className="academy-header-actions">
          <Link className="academy-city-link" href="/" prefetch={false}><ArrowLeft size={16} aria-hidden="true" /> Back to city</Link>
          <Link className="academy-city-link academy-help-link" href="/help">Study help</Link>
          <AccountButton />
        </div>
      </div>
    </header>
  );
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return <a className="academy-external" href={href} target="_blank" rel="noreferrer">{children}<ArrowUpRight size={15} aria-hidden="true" /></a>;
}

export function ExamAccess() {
  return (
    <section className="academy-access" aria-labelledby="access-title">
      <div>
        <h2 id="access-title">Taking the official exam</h2>
        <p>CertCity offers independent practice in English. Register through Anthropic Partner Academy with an eligible partner email, then schedule your proctored exam with Pearson.</p>
      </div>
      <div className="academy-access-links">
        <ExternalLink href={partnerCatalog}>Anthropic Partner Academy</ExternalLink>
        <ExternalLink href={partnerFAQ}>Eligibility and exam FAQ</ExternalLink>
        <ExternalLink href={pearson}>Pearson scheduling</ExternalLink>
      </div>
    </section>
  );
}
