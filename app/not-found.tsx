import type { Metadata } from "next";
import Link from "next/link";
import { AcademyHeader } from "../components/academy/chrome";
import { certificationCatalog } from "../lib/seo";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="academy-shell">
      <AcademyHeader />
      <main id="academy-main" tabIndex={-1} className="academy-width academy-catalog">
        <div className="academy-workspace-title">
          <h1>Page not found</h1>
          <p><Link href={certificationCatalog.path}>Browse Claude exam practice</Link> to find a certification pathway.</p>
        </div>
      </main>
    </div>
  );
}
