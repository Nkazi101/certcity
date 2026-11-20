import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AccountProvider } from "../components/account";
import "@fontsource-variable/inter";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";
import "./certifications/academy.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://certcity.org"),
  title: { default: "CertCity · City", template: "%s · CertCity" },
  applicationName: "CertCity",
  description: "Explore CertCity, solve problems for local organizations, and practice for professional certifications.",
  appleWebApp: { title: "CertCity" },
  openGraph: { type: "website", siteName: "CertCity" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#141B1F" };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body><AccountProvider>{children}</AccountProvider></body>
    </html>
  );
}
