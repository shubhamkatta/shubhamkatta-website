import { Fragment, useEffect } from 'react';
import { Paper, SectionLabel } from '../components/Shared';
import { now } from '../content/now';

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
    const title = 'Now — Shubham Katta';
    const description =
      'What I am currently building, reading, thinking about, and avoiding. A periodic snapshot.';
    document.title = title;
    setMeta('description', description);
    setMeta('og:title', title, true);
    setMeta('og:description', description, true);
    setMeta('og:url', `${SITE_ORIGIN}/now`, true);
    setMeta('twitter:title', title);
    setMeta('twitter:description', description);
    setCanonical(`${SITE_ORIGIN}/now`);
  }, []);
}

const ICON_STYLE = {
  width: '1.9em',
  height: '1.9em',
  verticalAlign: '-0.55em',
  marginRight: '0.3em',
  flexShrink: 0,
};

const CoffeeIcon = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true" style={ICON_STYLE}>
    {/* Steam */}
    <g fill="none" stroke="#d4a574" strokeWidth="1.5" strokeLinecap="round">
      <path d="M11 4 c -1 1.5 1 2 0 3.5 c -1 1.5 1 2 0 3.5" />
      <path d="M16 3 c -1 1.5 1 2 0 3.5 c -1 1.5 1 2 0 3.5" />
      <path d="M21 4 c -1 1.5 1 2 0 3.5 c -1 1.5 1 2 0 3.5" />
    </g>
    {/* Saucer shadow */}
    <ellipse cx="14" cy="28" rx="12" ry="1.4" fill="rgba(29,24,21,0.18)" />
    {/* Mug body */}
    <path
      d="M5 14 h16 v9 a4 4 0 0 1 -4 4 h-8 a4 4 0 0 1 -4 -4 z"
      fill="var(--white)"
      stroke="var(--text)"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    {/* Coffee surface (top rim) */}
    <ellipse cx="13" cy="14" rx="8" ry="1.5" fill="#6b4423" stroke="var(--text)" strokeWidth="1.3" />
    {/* Handle */}
    <path
      d="M21 16.5 c 3 0 4.5 1.5 4.5 3.5 c 0 2 -1.5 3.5 -4.5 3.5"
      fill="none"
      stroke="var(--text)"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const PinIcon = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true" style={ICON_STYLE}>
    <ellipse cx="16" cy="29" rx="6" ry="1" fill="rgba(29,24,21,0.18)" />
    <path d="M16 4 c -5 0 -8 3.4 -8 8 c 0 5 5 9.5 8 15 c 3 -5.5 8 -10 8 -15 c 0 -4.6 -3 -8 -8 -8 z" fill="#ff6b6b" stroke="var(--text)" strokeWidth="1.6" strokeLinejoin="round" />
    <circle cx="16" cy="12" r="3" fill="var(--white)" stroke="var(--text)" strokeWidth="1.3" />
  </svg>
);

const GithubIcon = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true" style={ICON_STYLE}>
    <circle cx="16" cy="16" r="12.5" fill="var(--text)" />
    <path d="M11 13 l -3 3 l 3 3 M21 13 l 3 3 l -3 3 M19 11 l -6 10" fill="none" stroke="var(--white)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const HeartIcon = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true" style={ICON_STYLE}>
    <path d="M16 27 c -6 -4 -10 -8 -10 -13 c 0 -3 2 -5 5 -5 c 2 0 4 1 5 3 c 1 -2 3 -3 5 -3 c 3 0 5 2 5 5 c 0 5 -4 9 -10 13 z" fill="#ff6b6b" stroke="var(--text)" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M11 14 l 2.5 0 l 1 -2 l 2 4 l 1 -2 l 3 0" fill="none" stroke="var(--white)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const BookIcon = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true" style={ICON_STYLE}>
    <ellipse cx="16" cy="29" rx="11" ry="1" fill="rgba(29,24,21,0.18)" />
    <path d="M5 7 l 11 2 l 0 19 l -11 -2 z" fill="#fff6db" stroke="var(--text)" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M27 7 l -11 2 l 0 19 l 11 -2 z" fill="#ffe9e4" stroke="var(--text)" strokeWidth="1.6" strokeLinejoin="round" />
    <line x1="16" y1="9" x2="16" y2="28" stroke="var(--text)" strokeWidth="1.4" />
    <line x1="8" y1="12" x2="13" y2="13" stroke="var(--text)" strokeWidth="0.8" opacity="0.6" />
    <line x1="8" y1="16" x2="13" y2="17" stroke="var(--text)" strokeWidth="0.8" opacity="0.6" />
    <line x1="19" y1="13" x2="24" y2="12" stroke="var(--text)" strokeWidth="0.8" opacity="0.6" />
    <line x1="19" y1="17" x2="24" y2="16" stroke="var(--text)" strokeWidth="0.8" opacity="0.6" />
  </svg>
);

const MusicIcon = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true" style={ICON_STYLE}>
    <ellipse cx="9" cy="23" rx="4" ry="3" fill="var(--text)" />
    <ellipse cx="22" cy="25" rx="4" ry="3" fill="#ff6b6b" stroke="var(--text)" strokeWidth="1.3" />
    <line x1="13" y1="23" x2="13" y2="8" stroke="var(--text)" strokeWidth="2" strokeLinecap="round" />
    <line x1="26" y1="25" x2="26" y2="10" stroke="var(--text)" strokeWidth="2" strokeLinecap="round" />
    <line x1="13" y1="8" x2="26" y2="10" stroke="var(--text)" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const PhoneIcon = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true" style={ICON_STYLE}>
    <rect x="9" y="3" width="14" height="26" rx="3" fill="var(--white)" stroke="var(--text)" strokeWidth="1.6" />
    <rect x="11" y="6.5" width="10" height="18" fill="var(--text)" />
    <circle cx="16" cy="27" r="1" fill="var(--text)" />
    <path d="M 12 11 q 2 -2.5 4 0 q 2 2.5 4 0" stroke="#ff6b6b" strokeWidth="1.3" fill="none" strokeLinecap="round" />
    <path d="M 12 15 q 2 -2.5 4 0 q 2 2.5 4 0" stroke="#ffd166" strokeWidth="1.3" fill="none" strokeLinecap="round" />
    <path d="M 12 19 q 2 -2.5 4 0 q 2 2.5 4 0" stroke="#a3e4a3" strokeWidth="1.3" fill="none" strokeLinecap="round" />
  </svg>
);

const TeaIcon = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true" style={ICON_STYLE}>
    {/* Steam */}
    <g fill="none" stroke="#9ec99e" strokeWidth="1.5" strokeLinecap="round">
      <path d="M11 4 c -1 1.5 1 2 0 3.5 c -1 1.5 1 2 0 3.5" />
      <path d="M16 3 c -1 1.5 1 2 0 3.5 c -1 1.5 1 2 0 3.5" />
      <path d="M21 4 c -1 1.5 1 2 0 3.5 c -1 1.5 1 2 0 3.5" />
    </g>
    {/* Saucer shadow */}
    <ellipse cx="14" cy="28" rx="12" ry="1.4" fill="rgba(29,24,21,0.18)" />
    {/* Cup body */}
    <path
      d="M5 14 h16 v9 a4 4 0 0 1 -4 4 h-8 a4 4 0 0 1 -4 -4 z"
      fill="var(--white)"
      stroke="var(--text)"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    {/* Tea surface (amber) */}
    <ellipse cx="13" cy="14" rx="8" ry="1.5" fill="#d4a256" stroke="var(--text)" strokeWidth="1.3" />
    {/* Ginger slice on top of the liquid */}
    <path
      d="M10.5 13 q 2 -2.4 5 -1 q -.6 2.4 -3 2.3 q -1.5 0 -2 -1.3 z"
      fill="#f0c878"
      stroke="var(--text)"
      strokeWidth="1"
      strokeLinejoin="round"
    />
    {/* Tiny leaf accent */}
    <path
      d="M15 11.5 q 2 -1.6 3.5 -.5 q -1 1.6 -2.6 1.4 z"
      fill="#7cb868"
      stroke="var(--text)"
      strokeWidth="0.9"
      strokeLinejoin="round"
    />
    {/* Handle */}
    <path
      d="M21 16.5 c 3 0 4.5 1.5 4.5 3.5 c 0 2 -1.5 3.5 -4.5 3.5"
      fill="none"
      stroke="var(--text)"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

function renderInline(text) {
  if (!text) return null;
  const out = [];
  let remaining = text;
  let key = 0;
  const boldRe = /\*\*([^*]+)\*\*/;
  const italicRe = /\*([^*]+)\*/;
  const iconRe = /\{(coffee|tea|pin|github|heart|book|music|phone)\}/;
  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/;
  while (remaining.length) {
    const boldM = remaining.match(boldRe);
    const italicM = remaining.match(italicRe);
    const iconM = remaining.match(iconRe);
    const linkM = remaining.match(linkRe);
    const candidates = [boldM, italicM, iconM, linkM]
      .filter(Boolean)
      .sort((a, b) => a.index - b.index);
    if (!candidates.length) {
      out.push(<span key={key++}>{remaining}</span>);
      break;
    }
    const next = candidates[0];
    if (next.index > 0) out.push(<span key={key++}>{remaining.slice(0, next.index)}</span>);
    if (next === boldM) {
      out.push(<strong key={key++}>{renderInline(boldM[1])}</strong>);
    } else if (next === italicM) {
      out.push(<em key={key++}>{renderInline(italicM[1])}</em>);
    } else if (next === iconM) {
      const name = next[1];
      if (name === 'coffee') out.push(<CoffeeIcon key={key++} />);
      else if (name === 'tea') out.push(<TeaIcon key={key++} />);
      else if (name === 'pin') out.push(<PinIcon key={key++} />);
      else if (name === 'github') out.push(<GithubIcon key={key++} />);
      else if (name === 'heart') out.push(<HeartIcon key={key++} />);
      else if (name === 'book') out.push(<BookIcon key={key++} />);
      else if (name === 'music') out.push(<MusicIcon key={key++} />);
      else if (name === 'phone') out.push(<PhoneIcon key={key++} />);
    } else if (next === linkM) {
      const href = linkM[2];
      const external = /^https?:/i.test(href);
      out.push(
        <a
          key={key++}
          href={href}
          className="inline-link"
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {renderInline(linkM[1])}
        </a>,
      );
    }
    remaining = remaining.slice(next.index + next[0].length);
  }
  return out;
}

function tiltFor(index) {
  const tilts = [-1.2, 1, -0.6, 0.8, -0.4, 1.1, -0.8];
  return tilts[index % tilts.length];
}

export function NowPage() {
  useSEO();
  return (
    <main className="container page-space">
      <div className="section-head with-badge" style={{ marginBottom: '1.2rem' }}>
        <div>
          <SectionLabel>right now</SectionLabel>
          <h1 style={{ fontSize: 'clamp(1.35rem, 4vw, 2.9rem)' }}>{now.byline}</h1>
          <p className="now-byline">{now.intro}</p>
        </div>
        <div className="badge-note">last updated {now.lastUpdated}</div>
      </div>

      <div className="now-timeline">
        {now.sections.map((section, i) => {
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
                  {section.items.map((item, j) => {
                    if (section.key === 'status' && j === 0) {
                      return (
                        <li key={j}>
                          <span className="now-status-dot" />
                          {renderInline(item)}
                        </li>
                      );
                    }
                    return <li key={j}>{renderInline(item)}</li>;
                  })}
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

      <div className="now-bottom-row">
        <Paper tone="paper-yellow" className="now-card now-bg now-bg-currently">
          <span className="now-bg-art" aria-hidden="true" />
          <SectionLabel>currently</SectionLabel>
          <p className="now-quote">
            The work is mostly translation — what the team meant, what the model can act on, what
            the user actually wanted. Three different languages, one keyboard.
          </p>
        </Paper>
        <Paper tone="paper-coral" className="now-card now-bg now-bg-now-page">
          <span className="now-bg-art" aria-hidden="true" />
          <SectionLabel tone="sky">a /now page is</SectionLabel>
          <p>
            A dated snapshot. Inspired by{' '}
            <a
              href="https://nownownow.com/about"
              className="text-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              nownownow.com
            </a>
            . The promise is that this page is mine and current; if it's stale, please nudge.
          </p>
        </Paper>
        <Paper tone="paper-blue" className="now-card now-bg now-bg-elsewhere">
          <span className="now-bg-art" aria-hidden="true" />
          <SectionLabel tone="ink">elsewhere on the site</SectionLabel>
          <ul className="simple-list">
            <li>
              <a className="text-link" href="/uses">
                what I use →
              </a>
            </li>
            <li>
              <a className="text-link" href="/writing">
                what I'm writing →
              </a>
            </li>
            <li>
              <a className="text-link" href="/contact">
                how to reach me →
              </a>
            </li>
          </ul>
        </Paper>
      </div>

      <div className="now-meta" style={{ marginTop: '2rem', textAlign: 'center' }}>
        at the moment, as of {now.lastUpdated} — and it moves when I move.
      </div>
    </main>
  );
}
