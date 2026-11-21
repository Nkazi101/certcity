"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { useEffect, useState } from "react";
import { allowsMeasurement, capturePracticeLanding, cleanMeasurementUrl, speedInsightsEnabled, webAnalyticsEnabled } from "../lib/practice-measurement";

export function SiteMeasurement() {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    if (!allowsMeasurement()) return;
    capturePracticeLanding();
    setAllowed(true);
  }, []);
  if (!allowed) return null;
  return <>
    {webAnalyticsEnabled && <Analytics beforeSend={(event) => {
      const url = cleanMeasurementUrl(event.url);
      return url && allowsMeasurement() ? { ...event, url } : null;
    }} />}
    {speedInsightsEnabled && <SpeedInsights beforeSend={(event) => {
      const url = cleanMeasurementUrl(event.url);
      return url && allowsMeasurement() ? { ...event, url } : null;
    }} />}
  </>;
}
