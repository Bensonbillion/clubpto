// Benson, Oct 29 2026: companies have a team-building budget (his team at
// his day job gets one every quarter), so the company nights page should
// speak to whoever spends it: people teams, office managers, team leads and
// the people who run cohorts and fellowships. And most offices are downtown,
// so the page says plainly how far District Padel is.
//
// Facts come from src/site/content.ts only (venue.nearby and friends were
// read on Google Maps on Oct 29). No prices beyond the ones already shown.

import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import BookPTO from "@/pages/BookPTO";
import { venue } from "@/site/content";
import { PAGE_META } from "@/site/pageMeta";

const html = renderToString(
  <MemoryRouter initialEntries={["/book-pto"]}>
    <BookPTO />
  </MemoryRouter>,
);
const text = html
  .replace(/<[^>]+>/g, " ")
  .replace(/&#x27;/g, "'")
  .replace(/&amp;/g, "&")
  .replace(/\s+/g, " ");

describe("Book PTO speaks to the team-building budget", () => {
  it("leads with team building", () => {
    expect(text).toMatch(/Team building · Company nights · Private parties/);
    expect(text).toMatch(/team-building budget/i);
    expect(text).toMatch(/invoice/i);
  });

  it("has a section for the people who plan it, cohorts included", () => {
    expect(text).toMatch(/You book it\. We do the rest\./);
    for (const t of ["Got a team-building budget?", "Big enough for the department", "Cohorts and programs too"]) {
      expect(text).toContain(t);
    }
  });

  it("says how far it is, from the facts file", () => {
    expect(text).toMatch(/Getting there/);
    for (const fact of [venue.nearby, venue.byCar, venue.byTransit, venue.fromWestEnd]) expect(text).toContain(fact);
    expect(text).toContain(venue.address);
  });

  it("answers the budget and distance questions", () => {
    expect(text).toContain("Can we put it on the team-building budget?");
    expect(text).toContain("How far is it from downtown?");
    expect(text).toContain("How many people can we bring?");
  });

  it("lets programs and cohorts say who they are on the form", () => {
    expect(html).toContain("Program or cohort");
    expect(html).toContain(">Team building</option>");
  });

  it("previews as team building when the link is shared", () => {
    expect(PAGE_META["/book-pto"].title).toMatch(/Team building/);
    expect(PAGE_META["/book-pto"].description).toMatch(/[Tt]eam building/);
  });

  it("keeps the house rules", () => {
    expect(text).not.toMatch(/—|–/);
    for (const w of ["exclusive", "elite", "luxury", "VIP", "premier", "offerings", "amenities", "members"]) {
      expect(text.toLowerCase()).not.toContain(w.toLowerCase());
    }
    expect(text).not.toMatch(/\bexperience\b/i);
  });
});
