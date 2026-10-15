// The old-branding pages retired on Oct 15 2026 and the page that replaced
// each one. Their links have been shared (Instagram, QR codes, group chats),
// so every path keeps landing somewhere current. The same list is in
// vercel.json as server redirects; a test keeps the two in step.
export const RETIRED: readonly (readonly [from: string, to: string])[] = [
  ["/about", "/"],
  ["/faq", "/play"],
  ["/book", "/play"],
  ["/community", "/events"],
  ["/league/join", "/league#season-2"],
  ["/install", "/play"],
  ["/club", "/"],
  ["/club/*", "/"],
  ["/membership", "/"],
];
