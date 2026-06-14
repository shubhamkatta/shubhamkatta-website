import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { posts } from '../src/content/posts.js';
import { caseStudies } from '../src/content/caseStudies.js';

const ORIGIN = 'https://shubhamkatta.com';
const __dirname = dirname(fileURLToPath(import.meta.url));

const toISO = (date) => {
  const d = new Date(date);
  return isNaN(d) ? undefined : d.toISOString().slice(0, 10);
};

const staticPages = [
  { loc: '/', changefreq: 'weekly', priority: '1.0' },
  { loc: '/about', changefreq: 'monthly', priority: '0.7' },
  { loc: '/work', changefreq: 'monthly', priority: '0.7' },
  { loc: '/writing', changefreq: 'weekly', priority: '0.9' },
  { loc: '/now', changefreq: 'weekly', priority: '0.7' },
  { loc: '/uses', changefreq: 'monthly', priority: '0.7' },
  { loc: '/colophon', changefreq: 'monthly', priority: '0.6' },
  { loc: '/case-studies', changefreq: 'monthly', priority: '0.6' },
  { loc: '/contact', changefreq: 'monthly', priority: '0.6' },
];

const postPages = posts.map((p) => ({
  loc: `/writing/${p.slug}`,
  lastmod: toISO(p.date),
  changefreq: 'yearly',
  priority: '0.6',
}));

const casePages = caseStudies.map((c) => ({
  loc: `/case-studies/${c.slug}`,
  changefreq: 'yearly',
  priority: '0.5',
}));

const urls = [...staticPages, ...postPages, ...casePages];

const body = urls
  .map(({ loc, lastmod, changefreq, priority }) => {
    const lines = [`    <loc>${ORIGIN}${loc}</loc>`];
    if (lastmod) lines.push(`    <lastmod>${lastmod}</lastmod>`);
    lines.push(`    <changefreq>${changefreq}</changefreq>`);
    lines.push(`    <priority>${priority}</priority>`);
    return `  <url>\n${lines.join('\n')}\n  </url>`;
  })
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;

writeFileSync(resolve(__dirname, '../public/sitemap.xml'), xml);
console.log(`sitemap.xml written with ${urls.length} URLs`);
