import { Fragment, useEffect } from 'react';
import { Paper, SectionLabel } from '../components/Shared';
import { colophon } from '../content/colophon';

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
    const title = 'Colophon — Shubham Katta';
    const description =
      'How this site is built — the typefaces, the palette, the rules I bent, the tools on the desk, and the people I borrowed from.';
    document.title = title;
    setMeta('description', description);
    setMeta('og:title', title, true);
    setMeta('og:description', description, true);
    setMeta('og:url', `${SITE_ORIGIN}/colophon`, true);
    setMeta('twitter:title', title);
    setMeta('twitter:description', description);
    setCanonical(`${SITE_ORIGIN}/colophon`);
  }, []);
}

function tiltFor(index) {
  const tilts = [-1, 0.8, -0.6, 1, -0.5, 0.7, -0.8, 0.5];
  return tilts[index % tilts.length];
}

export function ColophonPage() {
  useSEO();
  return (
    <main className="container page-space">
      <div className="section-head" style={{ marginBottom: '1.2rem' }}>
        <div>
          <SectionLabel>colophon</SectionLabel>
          <h1 style={{ fontSize: 'clamp(1.35rem, 4vw, 2.9rem)' }}>How this site is made</h1>
          <p className="now-byline">{colophon.intro}</p>
        </div>
      </div>

      <div className="now-timeline">
        {colophon.sections.map((section, i) => {
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
                  {section.items.map((item, j) =>
                    item.swatch ? (
                      <li key={j} className="colophon-row">
                        <span
                          className="colophon-swatch"
                          style={{ background: item.swatch }}
                          aria-hidden="true"
                        />
                        <div className="colophon-row-text">
                          <strong>{item.name}</strong>
                          {item.detail && <span className="uses-detail"> · {item.detail}</span>}
                          <span className="uses-context">{item.context}</span>
                        </div>
                      </li>
                    ) : (
                      <li key={j}>
                        <strong
                          className={item.font ? 'colophon-specimen' : undefined}
                          style={item.font ? { fontFamily: item.font } : undefined}
                        >
                          {item.name}
                        </strong>
                        {item.detail && <span className="uses-detail"> · {item.detail}</span>}
                        <span className="uses-context">{item.context}</span>
                      </li>
                    )
                  )}
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

    </main>
  );
}
