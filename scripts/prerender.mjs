import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { allRouteSeo, DEFAULT_OG_IMAGE } from '../src/content/seo.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, '../dist');
const template = readFileSync(join(DIST, 'index.html'), 'utf8');

const escapeAttr = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function replaceTagContent(html, attr, value, content) {
  if (content == null) return html;
  const re = new RegExp(`(<meta ${attr}="${value}" content=")[^"]*(")`);
  return html.replace(re, `$1${escapeAttr(content)}$2`);
}

function buildHtml(seo) {
  const ogImage = seo.ogImage || DEFAULT_OG_IMAGE;
  const type = seo.type || 'website';
  let html = template;

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeAttr(seo.title)}</title>`);
  html = replaceTagContent(html, 'name', 'description', seo.description);
  html = replaceTagContent(html, 'name', 'keywords', seo.keywords);
  html = replaceTagContent(html, 'property', 'og:title', seo.title);
  html = replaceTagContent(html, 'property', 'og:description', seo.description);
  html = replaceTagContent(html, 'property', 'og:type', type);
  html = replaceTagContent(html, 'property', 'og:url', seo.url);
  html = replaceTagContent(html, 'property', 'og:image', ogImage);
  html = replaceTagContent(html, 'name', 'twitter:title', seo.title);
  html = replaceTagContent(html, 'name', 'twitter:description', seo.description);
  html = replaceTagContent(html, 'name', 'twitter:image', ogImage);
  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${escapeAttr(seo.url)}$2`);

  if (seo.jsonLd) {
    const json = JSON.stringify(seo.jsonLd).replace(/</g, '\\u003c');
    const tag = `    <script type="application/ld+json" id="page-jsonld">${json}</script>\n  </head>`;
    html = html.replace('  </head>', tag);
  }

  return html;
}

let count = 0;
for (const { path, seo } of allRouteSeo()) {
  const html = buildHtml(seo);
  const outDir = path === '/' ? DIST : join(DIST, path);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), html);
  count += 1;
}

console.log(`prerendered ${count} routes into dist/`);
