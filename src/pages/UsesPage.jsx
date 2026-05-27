import { Fragment, useEffect } from 'react';
import { Paper, SectionLabel } from '../components/Shared';
import { uses } from '../content/uses';

const SITE_ORIGIN = 'https://shubhamkatta.com';

function setMeta(name, content, isProperty = false) {
  if (!content) return;
  const attr = isProperty ? 'property' : 'name';
  let el = document.head.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(url) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', url);
}

function useSEO() {
  useEffect(() => {
    const title = 'Uses — Shubham Katta';
    const description =
      'A working inventory of the hardware, software, and small habits I rely on. Updated when something earns its keep.';
    document.title = title;
    setMeta('description', description);
    setMeta('og:title', title, true);
    setMeta('og:description', description, true);
    setMeta('og:url', `${SITE_ORIGIN}/uses`, true);
    setMeta('twitter:title', title);
    setMeta('twitter:description', description);
    setCanonical(`${SITE_ORIGIN}/uses`);
  }, []);
}

function tiltFor(index) {
  const tilts = [-1, 0.8, -0.6, 1, -0.5, 0.7, -0.8, 0.5];
  return tilts[index % tilts.length];
}

export function UsesPage() {
  useSEO();
  return (
    <main className="container page-space">
      <div className="section-head" style={{ marginBottom: '1.2rem' }}>
        <div>
          <SectionLabel>uses</SectionLabel>
          <h1 style={{ fontSize: 'clamp(1.35rem, 4vw, 2.9rem)' }}>What I actually use</h1>
          <p className="now-byline">{uses.intro}</p>
        </div>
      </div>

      <div className="now-timeline">
        {uses.sections.map((section, i) => {
          const side = i % 2 === 0 ? 'left' : 'right';
          const startRow = i * 3 + 1;
          const tilt = tiltFor(i);
          return (
            <Fragment key={section.key}>
              <Paper
                tone={section.tone}
                className={`now-card timeline-card timeline-${side} now-bg now-bg-${section.key}`}
                style={{
                  gridColumn: side === 'left' ? 1 : 3,
                  gridRow: `${startRow} / span 5`,
                  transform: `rotate(${tilt}deg)`,
                }}
              >
                <span className="now-bg-art" aria-hidden="true" />
                <h2>
                  <span className="arrow-prefix">↬</span>
                  {section.title}
                </h2>
                <ul>
                  {section.items.map((item, j) => (
                    <li key={j}>
                      <strong>{item.name}</strong>
                      <span className="uses-detail"> · {item.detail}</span>
                      <span className="uses-context">{item.context}</span>
                    </li>
                  ))}
                </ul>
              </Paper>
              <span
                className="timeline-dot"
                aria-hidden="true"
                style={{
                  gridColumn: 2,
                  gridRow: `${startRow} / span 1`,
                  animationDelay: `${i * 0.18}s`,
                }}
              />
            </Fragment>
          );
        })}
      </div>

      <div className="uses-attribution">
        Inspired by{' '}
        <a className="text-link" href="https://uses.tech" target="_blank" rel="noopener noreferrer">
          uses.tech
        </a>
        , a directory of /uses pages. If you have one, send it over — I read these like menus.
      </div>
    </main>
  );
}
