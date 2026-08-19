// The manager's typefaces, loaded only when the manager is opened.
//
// index.html carries the PUBLIC site's stack (Bricolage Grotesque, DM Sans,
// Yellowtail) plus VT323. Manage needs Inter and Playfair Display, and neither
// is there — without this the champion's name falls back to a system serif and
// every screen renders in the wrong sans.
//
// Adding them to index.html would work and would also make every marketing
// page download two families it never draws. The manager is a lazy route, so
// the link goes in when the route mounts instead: the people who pay for the
// fonts are the people looking at them.

const ID = "manage-fonts";
const HREF =
  "https://fonts.googleapis.com/css2" +
  "?family=Inter:wght@400;500;600;700;800" +
  "&family=Playfair+Display:wght@500;600;700" +
  "&family=VT323" +
  "&display=swap";

/** Idempotent — remounting the route must not stack duplicate links. */
export function ensureManageFonts(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(ID)) return;
  const link = document.createElement("link");
  link.id = ID;
  link.rel = "stylesheet";
  link.href = HREF;
  document.head.appendChild(link);
}
