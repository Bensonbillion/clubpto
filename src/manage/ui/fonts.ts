// The manager's typefaces, loaded only when the manager is opened.
//
// index.html carries the PUBLIC site's stack (Bricolage Grotesque, DM Sans,
// Yellowtail). The manager draws on Organic instead, and Organic asks for two
// families and only two: Caprasimo for headings, scores and every numeral that
// is a value, Figtree for everything you read as a sentence. Neither is in
// index.html, so without this the champion's name falls back to a system serif
// and every screen renders in the wrong sans.
//
// Adding them to index.html would work and would also make every marketing
// page download two families it never draws. The manager is a lazy route, so
// the link goes in when the route mounts instead: the people who pay for the
// fonts are the people looking at them.
//
// Caprasimo ships a single weight, 400, which is why nothing in the manager
// asks for a bolder heading. Figtree carries the weights the frames actually
// use: 400 for body copy, 500 and 600 for labels and buttons, 700 for the
// active tab, 800 for the loudest eyebrows.

const ID = "manage-fonts";
const HREF =
  "https://fonts.googleapis.com/css2" +
  "?family=Caprasimo" +
  "&family=Figtree:wght@400;500;600;700;800" +
  "&display=swap";

// Both stacks carry a real fallback, not a bare generic. A league night starts
// on whatever signal the club has, and `display=swap` means the first paint is
// the fallback: the operator reads these faces before Google answers, so the
// substitutes have to be shapes that hold the same layout.
//
// Caprasimo is a heavy display face with tall, round bowls. Playfair Display is
// already on the public site's Google request and is the closest thing to it a
// phone is likely to have cached; Georgia is the widest-installed serif with
// enough weight to stand in at 76px.
export const HEADING_FONT = "'Caprasimo', 'Playfair Display', Georgia, serif";

// Figtree is a geometric humanist sans. system-ui resolves to SF on the iPhone
// this runs on, which is the nearest match anyone will have locally.
export const BODY_FONT =
  "'Figtree', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/** Idempotent, because remounting the route must not stack duplicate links. */
export function ensureManageFonts(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(ID)) return;
  const link = document.createElement("link");
  link.id = ID;
  link.rel = "stylesheet";
  link.href = HREF;
  document.head.appendChild(link);
}
