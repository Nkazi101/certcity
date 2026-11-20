import type { Metadata } from "next";
import { AcademyHeader } from "../components/academy/chrome";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="academy-shell">
      <AcademyHeader />
      <main className="academy-width academy-catalog">
        <div className="academy-workspace-title">
          <h1>Page not found</h1>
        </div>
      </main>
    </div>
  );
}
