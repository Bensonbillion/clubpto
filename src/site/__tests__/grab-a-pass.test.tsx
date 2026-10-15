// Bug, Oct 15 2026 (Benson): "top banner grab a pass doesn't work".
// The announcement bar's "Grab a pass" went to /play, the info page, not to
// the Thursday booking page like every other "Grab a pass" on the site; on
// /play itself it did nothing at all. The 404 page's "Grab a Thursday pass"
// and the home page's Thursday card had the same mismatch.
//
// Rule: anything that says "Grab a pass" or "Grab a Thursday pass" opens
// the Thursday booking page, on every page, banner and header included.

import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ComponentType } from "react";
import SiteLayout from "@/site/ui/SiteLayout";
import Home from "@/pages/Home";
import Play from "@/pages/Play";
import League from "@/pages/League";
import Events from "@/pages/Events";
import SkillsLab from "@/pages/SkillsLab";
import BookPTO from "@/pages/BookPTO";
import Partners from "@/pages/Partners";
import NotFound from "@/pages/NotFound";
import { thursday } from "@/site/content";

const pages: [string, ComponentType][] = [
  ["/", Home],
  ["/play", Play],
  ["/league", League],
  ["/events", Events],
  ["/skills-lab", SkillsLab],
  ["/book-pto", BookPTO],
  ["/partners", Partners],
  ["/no-such-page", NotFound],
];

/** The page as a visitor gets it: the banner, header and footer around it. */
const render = (path: string, Page: ComponentType) =>
  renderToString(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<SiteLayout />}>
          <Route path="*" element={<Page />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"');

/** Every link whose words say "Grab a ... pass", with where it goes. */
const passLinks = (html: string) =>
  [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)]
    .map(([, attrs, inner]) => ({
      href: decode(/\bhref="([^"]*)"/.exec(attrs)?.[1] ?? ""),
      words: decode(inner.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim(),
    }))
    .filter((l) => /grab a (thursday )?pass/i.test(l.words));

describe.each(pages)("%s", (path, Page) => {
  const links = passLinks(render(path, Page));

  it("has the banner's and the header's Grab a pass", () => {
    expect(links.length).toBeGreaterThanOrEqual(2);
  });

  it("sends every Grab a pass to the Thursday booking page", () => {
    for (const l of links) expect({ words: l.words, href: l.href }).toEqual({ words: l.words, href: thursday.bookingUrl });
  });
});
