import { posts } from './posts.js';
import { caseStudies } from './caseStudies.js';

export const SITE_ORIGIN = 'https://shubhamkatta.com';
export const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/bitmoji-relax.png`;

const person = { '@type': 'Person', name: 'Shubham Katta', url: SITE_ORIGIN };

export const homeSeo = {
  title: 'Shubham Katta — engineer, writer, observer of small patterns',
  description:
    'A personal space for work, writing, humour, and whatever else survives being noticed. Essays on Claude Code, MCP, prompt engineering, evals, and the human side of building software.',
  keywords:
    'Shubham Katta, software engineer, principal engineer, AI engineering, Claude Code, MCP, prompt engineering, evals, threat intelligence, writing',
  url: `${SITE_ORIGIN}/`,
  jsonLd: {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_ORIGIN}/#website`,
        url: SITE_ORIGIN,
        name: 'Shubham Katta',
        description:
          'A personal space for work, writing, humour, and whatever else survives being noticed.',
      },
      {
        '@type': 'Person',
        '@id': `${SITE_ORIGIN}/#person`,
        name: 'Shubham Katta',
        url: SITE_ORIGIN,
        image: `${SITE_ORIGIN}/bitmoji-relax.png`,
        jobTitle: 'Principal Software Engineer',
        worksFor: { '@type': 'Organization', name: 'Cyble Inc.' },
        sameAs: ['https://www.linkedin.com/in/kattashubham/'],
        knowsAbout: [
          'Software Engineering',
          'AI Engineering',
          'Claude Code',
          'Model Context Protocol',
          'Threat Intelligence',
          'Prompt Engineering',
        ],
      },
    ],
  },
};

export const aboutSeo = {
  title: 'About — Shubham Katta',
  description:
    'More internet room, less corporate lobby. Shubham Katta on systems, people, incentives, and the gap between what people say and what they do.',
  keywords: 'Shubham Katta, about, software engineer, systems thinking, writer, observer',
  url: `${SITE_ORIGIN}/about`,
};

export const workSeo = {
  title: 'Work — Shubham Katta',
  description:
    'Nine years of building systems and products — threat intelligence pipelines, correlation engines, and search-heavy APIs at scale. The professional chapter, told honestly.',
  keywords:
    'Shubham Katta, work experience, Principal Software Engineer, Cyble, threat intelligence, correlation engine, APIs at scale',
  url: `${SITE_ORIGIN}/work`,
};

export const writingIndexSeo = {
  title: 'Writings & notes — Shubham Katta',
  description:
    'Essays, technical deep-dives on Claude Code, MCP, prompt engineering, evals, token optimization, and observations on systems and people.',
  keywords:
    'Claude Code, AI engineering, MCP, prompt engineering, evals, token optimization, Anthropic, agents, skills, plugins',
  url: `${SITE_ORIGIN}/writing`,
};

export const nowSeo = {
  title: 'Now — Shubham Katta',
  description:
    'What Shubham Katta is currently building, reading, thinking about, and avoiding — a periodic snapshot from a desk in Moradabad, India.',
  keywords: 'Shubham Katta, now page, currently building, reading, AI engineering, threat intelligence',
  url: `${SITE_ORIGIN}/now`,
};

export const usesSeo = {
  title: 'Uses — Shubham Katta',
  description:
    'A working inventory of the hardware, software, and small habits Shubham Katta relies on. Updated when something earns its keep.',
  keywords: 'uses page, developer setup, tools, hardware, software, Shubham Katta',
  url: `${SITE_ORIGIN}/uses`,
};

export const colophonSeo = {
  title: 'Colophon — Shubham Katta',
  description:
    'How this site is built — the typefaces, the palette, the rules bent, and the people borrowed from. A margin note on the making of shubhamkatta.com.',
  keywords: 'colophon, typography, color palette, design system, Inter, Caveat, Fraunces, Shubham Katta',
  url: `${SITE_ORIGIN}/colophon`,
};

export const caseIndexSeo = {
  title: 'Case files — Shubham Katta',
  description:
    'Detailed situations where technical problems were never only technical — domain theft, partner disputes, and the human stakes behind the systems.',
  keywords: 'Shubham Katta, case studies, case files, domain theft, business continuity, technical problem solving',
  url: `${SITE_ORIGIN}/case-studies`,
};

export const contactSeo = {
  title: 'Say hello — Shubham Katta',
  description:
    'Get in touch with Shubham Katta. Thoughtful messages, strange observations, work, collaborations, or a shared curiosity about how weirdly human everything turns out to be.',
  keywords: 'Shubham Katta, contact, say hello, get in touch, book a call, LinkedIn, email',
  url: `${SITE_ORIGIN}/contact`,
};

export function postSeo(post) {
  if (!post) {
    return { title: 'Writing — Shubham Katta', url: `${SITE_ORIGIN}/writing` };
  }
  const published = new Date(post.date);
  const image = post.cover ? `${SITE_ORIGIN}${post.cover}` : undefined;
  return {
    title: `${post.title} — Shubham Katta`,
    description: post.seoDescription || post.excerpt,
    keywords: post.keywords,
    ogImage: image,
    url: `${SITE_ORIGIN}/writing/${post.slug}`,
    type: 'article',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.seoDescription || post.excerpt,
      image,
      datePublished: !isNaN(published) ? published.toISOString() : undefined,
      author: person,
      publisher: person,
      mainEntityOfPage: `${SITE_ORIGIN}/writing/${post.slug}`,
      keywords: post.keywords,
    },
  };
}

export function caseSeo(item) {
  if (!item) {
    return { title: 'Case study — Shubham Katta', url: `${SITE_ORIGIN}/case-studies` };
  }
  return {
    title: `${item.title} — Shubham Katta`,
    description: item.summary || item.intro,
    keywords: 'Shubham Katta, case study, case files',
    url: `${SITE_ORIGIN}/case-studies/${item.slug}`,
    type: 'article',
  };
}

export function allRouteSeo() {
  return [
    { path: '/', seo: homeSeo },
    { path: '/about', seo: aboutSeo },
    { path: '/work', seo: workSeo },
    { path: '/writing', seo: writingIndexSeo },
    { path: '/now', seo: nowSeo },
    { path: '/uses', seo: usesSeo },
    { path: '/colophon', seo: colophonSeo },
    { path: '/case-studies', seo: caseIndexSeo },
    { path: '/contact', seo: contactSeo },
    ...posts.map((p) => ({ path: `/writing/${p.slug}`, seo: postSeo(p) })),
    ...caseStudies.map((c) => ({ path: `/case-studies/${c.slug}`, seo: caseSeo(c) })),
  ];
}
