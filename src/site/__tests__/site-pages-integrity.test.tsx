// The redesigned pages render no unconfirmed facts.
//
// src/site/content.ts holds every fact the new pages print, with
// TODO_BENSON for anything not yet confirmed. Elements that depend on one
// hide themselves. This renders each page to HTML and fails if the
// sentinel, or a design-stage "[bracketed placeholder]", ever reaches it.

import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import type { ComponentType } from "react";
import Home from "@/pages/Home";
import Play from "@/pages/Play";
import League from "@/pages/League";
import Events from "@/pages/Events";
import BookPTO from "@/pages/BookPTO";
import Partners from "@/pages/Partners";
import { TODO, nextThursday, shortDay } from "@/site/content";

const pages: [string, ComponentType][] = [
  ["/", Home],
  ["/play", Play],
  ["/league", League],
  ["/events", Events],
  ["/book-pto", BookPTO],
  ["/partners", Partners],
];

const render = (path: string, Page: ComponentType) =>
  renderToString(
    <MemoryRouter initialEntries={[path]}>
      <Page />
    </MemoryRouter>,
  );

// Visible text only: attribute values and markup are not copy.
const text = (html: string) => html.replace(/<[^>]+>/g, " ");

describe.each(pages)("%s", (path, Page) => {
  const html = render(path, Page);

  it("renders a real page", () => {
    expect(html.length).toBeGreaterThan(2000);
  });

  it(`never prints the ${TODO} sentinel`, () => {
    expect(html.includes(TODO)).toBe(false);
  });

  it("never prints a [bracketed placeholder]", () => {
    expect(text(html).match(/\[[^\]]{2,}\]/g) ?? []).toEqual([]);
  });

  it("has exactly one h1", () => {
    expect(html.match(/<h1[\s>]/g)?.length).toBe(1);
  });

  it("gives every image alt text", () => {
    const imgs = html.match(/<img\b[^>]*>/g) ?? [];
    expect(imgs.length).toBeGreaterThan(0);
    for (const img of imgs) expect(img).toMatch(/alt="[^"]+"/);
  });
});

describe("dates", () => {
  it("next Thursday is a Thursday, never before the first one", () => {
    expect(shortDay(nextThursday(new Date("2026-10-13T12:00:00-04:00")))).toBe("Thu · Oct 15");
    expect(nextThursday(new Date("2026-10-15T21:00:00-04:00"))).toBe("2026-10-15");
    expect(nextThursday(new Date("2026-10-15T22:30:00-04:00"))).toBe("2026-10-22");
    expect(nextThursday(new Date("2026-10-18T09:00:00-04:00"))).toBe("2026-10-22");
    expect(nextThursday(new Date("2026-09-01T09:00:00-04:00"))).toBe("2026-10-15");
  });
});
