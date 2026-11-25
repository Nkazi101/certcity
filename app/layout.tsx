import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AccountProvider } from "../components/account";
import { SiteMeasurement } from "../components/site-measurement";
import { siteName, siteOrigin } from "../lib/seo";
import "@fontsource-variable/inter";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";
import "./certifications/academy.css";
import { speedInsightsEnabled, webAnalyticsEnabled } from "../lib/practice-measurement";
import { PrePaintScript } from "../components/pre-paint-script";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: { default: siteName, template: `%s · ${siteName}` },
  applicationName: siteName,
  appleWebApp: { title: siteName },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION?.trim() || undefined,
    other: process.env.BING_SITE_VERIFICATION?.trim()
      ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION.trim() }
      : undefined,
  },
};

export const viewport: Viewport = { themeColor: "#141B1F" };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    // The pre-paint script marks <html> (data-restoring, data-city-light) before hydration, so suppress the mismatch.
    <html lang="en" suppressHydrationWarning>
      <head>
        <PrePaintScript />
      </head>
      <body><AccountProvider>{children}</AccountProvider>{(webAnalyticsEnabled || speedInsightsEnabled) && <SiteMeasurement />}</body>
    </html>
  );
}
