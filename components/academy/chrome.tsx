import { ArrowLeft, ArrowUpRight, CircleHelp } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { partnerCatalog, partnerFAQ, pearson } from "../../lib/claude/blueprints";
import { AccountButton } from "../account";
import styles from "./chrome.module.css";

export function AcademyHeader({ current }: { current?: "tracks" | "help" } = {}) {
  return (
    <header className="academy-header">
      <a className={styles.skip} href="#academy-main">Skip to main content</a>
      <div className={`academy-width academy-header-inner ${styles.header}`}>
        <Link className="academy-wordmark" href="/" prefetch={false} aria-label="CertCity home">
          <picture>
            <source media="(max-width: 365px)" srcSet="/brand/mark-primary.svg" width={400} height={400} />
            <img src="/brand/wordmark-primary.svg" width={2000} height={545} alt="" />
          </picture>
        </Link>
        <div className={styles.actions}>
          <nav aria-label="Academy" className={styles.navigation}>
            <Link href="/" prefetch={false} aria-label="Back to city"><ArrowLeft size={16} aria-hidden="true" /> City</Link>
            <Link href="/certifications" aria-current={current === "tracks" ? "page" : undefined}>All tracks</Link>
            <Link href="/help" aria-current={current === "help" ? "page" : undefined} aria-label="Study help" title="Study help">
              <CircleHelp size={17} aria-hidden="true" /><span>Study help</span>
            </Link>
          </nav>
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
