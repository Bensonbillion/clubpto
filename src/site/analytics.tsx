// Visit tracking: Vercel Web Analytics on the public site. Page views,
// where visitors come from, devices and countries, in the Vercel dashboard
// (project clubpto-site > Analytics). No cookies, so no consent banner.
//
// The back-of-house tools are left out: /manage, /manage2, /admin and
// /league/admin are operators, not visitors. Form sign-ups are counted
// separately, one row each, in the "PTO Website: form entries" Sheet.

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/react";

const BACK_OF_HOUSE = /^\/(manage|manage2|admin|league\/admin)(\/|$)/;

export const keepVisit = (event: BeforeSendEvent): BeforeSendEvent | null => {
  try {
    return BACK_OF_HOUSE.test(new URL(event.url).pathname) ? null : event;
  } catch {
    return event;
  }
};

export const SiteAnalytics = () => <Analytics beforeSend={keepVisit} />;
