// After `vite build`: write a copy of dist/index.html for each public page
// with that page's title, description, canonical URL and share image in the
// <head>. iMessage, WhatsApp, LinkedIn and Slack read the raw HTML and never
// run the app, so without this every shared link previewed as the home page.
//
// The values come from src/site/pageMeta.ts (the same object the pages use
// in the browser), loaded through Vite so the @/ imports resolve.
// vercel.json rewrites each page's path to its file (/play -> /_meta/play.html);
// a test keeps those rewrites in step with PAGE_META.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Replace one tag's attribute value, or fail loudly if the tag is missing. */
const setAttr = (html, tagPattern, attr, value) => {
  const re = new RegExp(`(<${tagPattern}[^>]*?\\s${attr}=")[^"]*(")`);
  if (!re.test(html)) throw new Error(`page-html: no tag matching ${tagPattern} in dist/index.html`);
  return html.replace(re, `$1${esc(value)}$2`);
};

export const pageHtml = (template, site, path, meta) => {
  const url = `${site}${path}`;
  const image = `${site}${meta.image}`;
  let html = template.replace(/<title>[^<]*<\/title>/, `<title>${esc(meta.title)}</title>`);
  html = setAttr(html, 'meta name="description"', "content", meta.description);
  html = setAttr(html, 'link rel="canonical"', "href", url);
  html = setAttr(html, 'meta property="og:title"', "content", meta.title);
  html = setAttr(html, 'meta property="og:description"', "content", meta.description);
  html = setAttr(html, 'meta property="og:url"', "content", url);
  html = setAttr(html, 'meta property="og:image"', "content", image);
  html = setAttr(html, 'meta name="twitter:image"', "content", image);
  return html;
};

const main = async () => {
  const server = await createServer({
    root,
    logLevel: "error",
    server: { middlewareMode: true, hmr: false },
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    const { PAGE_META, SITE, metaFileFor } = await server.ssrLoadModule("/src/site/pageMeta.ts");
    const template = readFileSync(join(dist, "index.html"), "utf8");
    for (const [path, meta] of Object.entries(PAGE_META)) {
      const file = join(dist, metaFileFor(path));
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, pageHtml(template, SITE, path, meta));
      console.log(`page-html: ${path} -> ${metaFileFor(path)}`);
    }
  } finally {
    await server.close();
  }
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
