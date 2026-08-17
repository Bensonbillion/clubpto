// Skills Lab content integrity — runs as part of `npm run build`.
//
// The page hides every element that depends on an unconfirmed fact. This
// test is the enforcement: it server-renders the whole page and fails the
// build if the TODO_BENSON sentinel ever reaches HTML — which is exactly
// what happens if someone renders a content-file value without an isSet()
// guard.

import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import SkillsLab from "@/pages/SkillsLab";
import { TODO } from "@/content/skillsLab";

const renderPage = (): string =>
  renderToString(
    <MemoryRouter initialEntries={["/skills-lab"]}>
      <SkillsLab />
    </MemoryRouter>
  );

describe("Skills Lab renders no unconfirmed facts", () => {
  it(`no ${TODO} sentinel reaches rendered HTML`, () => {
    const html = renderPage();
    if (html.includes(TODO)) {
      throw new Error(
        `UNCONFIRMED FACT RENDERED: the ${TODO} sentinel reached the page's ` +
          "HTML. An element is rendering a skillsLab content value without " +
          "an isSet() guard. Hide the element until Benson fills the value in."
      );
    }
    expect(html.includes(TODO)).toBe(false);
  });

  it("the page renders at all (guard against a silently broken tree)", () => {
    expect(renderPage().length).toBeGreaterThan(2000);
  });
});
