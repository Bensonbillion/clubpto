// Title, description and share image for each public page, in one place.
//
// The pages set these in the browser (usePageMeta), and the build writes
// them into a copy of index.html per page (scripts/page-html.mjs), because
// iMessage, WhatsApp, LinkedIn and Slack read the raw HTML and never run the
// app. Without that, every shared link previewed as the home page.

import { thursday, venue } from "@/site/content";
import { skillsLab } from "@/content/skillsLab";

export const SITE = "https://clubpto.com";

export interface PageMeta {
  title: string;
  description: string;
  /** Share image, 1200 x 630, under public/. */
  image: string;
}

export const PAGE_META = {
  "/": {
    title: "Club PTO · Toronto's padel social club",
    description:
      "Not your average padel club. Thursday nights at District Padel, the PTO League on Sundays and COURTSIDE in the summer.",
    image: "/og-image.jpg",
  },
  "/play": {
    title: "Thursday meets · Club PTO",
    description: `Thursday plans, sorted. Padel every Thursday at ${venue.name}, Mississauga. ${thursday.startTime} to ${thursday.endTime}, three courts split by level, ${thursday.price} including HST. Come solo.`,
    image: "/og/play.jpg",
  },
  "/league": {
    title: "PTO League · Club PTO",
    description:
      "Time to see where you actually rank. PTO League: Americano padel on Sundays at District Padel, Mississauga, live standings in three divisions and a Finals Night to crown each champion.",
    image: "/og/league.jpg",
  },
  "/events": {
    title: "Events · Club PTO",
    description:
      "The nights everyone posts about. COURTSIDE, our summer day party at The Pad, plus Finals Night and community nights. Padel at the centre, music and the hang all around it.",
    image: "/og/events.jpg",
  },
  "/skills-lab": {
    title: "Skill Lab · Club PTO",
    description: `Four weeks of small-group padel coaching in Toronto. Six players, one coach, every level. $${skillsLab.cohortPrice} for the four weeks. Get on the list for the next cohort.`,
    image: "/og/skills-lab.jpg",
  },
  "/book-pto": {
    title: "Book PTO · Company nights and private parties · Club PTO",
    description:
      "Skip the escape room. Two hours of padel, run start to finish by Club PTO. Company nights, team socials and private parties in Mississauga. First-timers welcome.",
    image: "/og/book-pto.jpg",
  },
  "/partners": {
    title: "Partners · Club PTO",
    description:
      "Partner with Club PTO, Toronto's padel social club. Thursday nights, the PTO League and COURTSIDE. Request the media kit.",
    image: "/og/partners.jpg",
  },
} satisfies Record<string, PageMeta>;

export type PagePath = keyof typeof PAGE_META;

/** The file the build writes for a page: "/play" -> "_meta/play.html". */
export const metaFileFor = (path: PagePath): string =>
  path === "/" ? "index.html" : `_meta/${path.slice(1)}.html`;
