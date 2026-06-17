import { Link } from 'react-router-dom';
import { posts } from '../content/posts';
import { chips, findings, metrics, roles, site } from '../content/site';
import { build } from '../content/build';
import { Chip, Paper, PostCard, SectionLabel } from '../components/Shared';
import { CurrentlyBlock } from '../components/CurrentlyBlock';
import { useSEO } from '../components/useSEO';
import { homeSeo } from '../content/seo';

const FEATURED_SLUG = 'why-i-built-plynth-rebuilding-the-same-saas-plumbing-four-times';

export function HomePage() {
  useSEO(homeSeo);
  const featured = posts.find(p => p.slug === FEATURED_SLUG) || posts[0];
  return (
    <main>
      <section className="hero container">
        <div className="chip-row chip-row-tilted">
          {chips.map((chip, i) => (
            <Chip key={chip} tone={['paper-white', 'paper-yellow', 'paper-blue', 'paper-coral'][i % 4]}>
              {chip}
            </Chip>
          ))}
        </div>
        <div className="split-grid hero-grid">
          <Paper className="hero-card">
            <SectionLabel>personal internet space</SectionLabel>
            <h1 style={{ marginBottom: '1.5rem' }}>A personal space for work, writing, humour, and whatever else survives being noticed.</h1>
            <p className="lead">
              Hi, I’m Shubham. I build software professionally, think about people a little too much, and write about systems, identity, work, the internet, and the odd patterns hiding inside ordinary life.
            </p>
            <p className="lead">
              This is less a formal website and more a living archive — part notebook, part portfolio, part internet home, part place where I try to say certain things honestly before they become too polished to mean anything.
            </p>
            <div className="button-row">
              <Link to="/writing" className="button button-primary">read the writings</Link>
              <Link to="/about" className="button button-soft">meet the human</Link>
              <Link to="/work" className="button button-blue">yes, there is work too</Link>
            </div>
          </Paper>
        <div className="hero-right-stack">
          <Paper className="bio-card bio-card-compact" tone="paper-yellow">
            <Link
              to="/now"
              className="badge-note hello-badge at-the-moment-link"
              aria-label="See the /now page for a longer snapshot"
            >
              at the moment →
            </Link>
            <div className="bio-hero">
              <img className="bitmoji" src="/bitmoji-relax.png" alt="Shubham bitmoji reading with a cat" />
              <div>
                <h2>building things, collecting patterns, staying curious</h2>
              </div>
            </div>
          </Paper>
          <CurrentlyBlock />
        </div>
        </div>
      </section>

      <section className="container me-findings-section">
        <Paper className="about-home findings-block ink-block me-findings now-bg now-bg-notebook" tone="ink-block">
          <span className="now-bg-art" aria-hidden="true" />
          <div className="me-findings-split">
            <div className="me-side">
              <div className="badge-note about-badge">me, but with paragraphs</div>
              <SectionLabel tone="light">me</SectionLabel>
              <h2 style={{ marginBottom: '1.2rem' }}>I like people who think clearly, write honestly, and don’t confuse depth with heaviness.</h2>
              <p>
                I’m interested in the gap between what people say, what they do, what they avoid, and the stories they tell themselves about all three. A surprising amount of work, identity, ambition, and love seems to live there — equal interest in systems, people, incentives, and why some truths arrive wearing jokes.
              </p>
              <p>
                So yes, this site will have software. But it will also have personal experiences, strange realizations, casual findings, internet rabbit holes, and bits of humour that usually show up when truth gets tired of dressing formally.
              </p>
              <Link to="/about" className="read-more-link">read more about me →</Link>
            </div>
            <div className="findings-side">
              <div className="badge-note dark findings-badge">collected in real time</div>
              <SectionLabel tone="light">casual findings</SectionLabel>
              <h3 className="findings-headline">Some thoughts I’ve probably earned the right to overstate.</h3>
              <div className="findings-stack">
                {findings.slice(0, 3).map((item, idx) => (
                  <div key={item} className={`finding-card ${idx % 2 ? 'finding-gold' : 'finding-dark'}`}>
                    <div className="finding-label">finding 0{idx + 1}</div>
                    <div>{item}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Paper>
      </section>

      {posts[0] && (
        <section className="container section-space">
          <div className="section-head with-badge">
            <div>
              <SectionLabel>featured</SectionLabel>
              <h2>Just shipped — a longer piece worth a read.</h2>
            </div>
            <div className="badge-note">new</div>
          </div>
          <Paper className="featured-card" tone="paper-yellow">
            <div className="featured-grid">
              <Link to={`/writing/${featured.slug}`} className="featured-cover" aria-label={featured.title}>
                <img src={featured.cover} alt={featured.title} loading="lazy" />
              </Link>
              <div className="featured-content">
                <span className="post-type">{featured.type}</span>
                <h3 className="featured-title">{featured.title}</h3>
                <p className="featured-excerpt">{featured.excerpt}</p>
                <Link to={`/writing/${featured.slug}`} className="read-more-link">read this →</Link>
              </div>
            </div>
          </Paper>
        </section>
      )}

      <section className="container section-space">
        <div className="section-head with-badge">
          <div>
            <SectionLabel>writings</SectionLabel>
            <h2>Essays, notes, personal journeys, and thoughts that refused to stay private.</h2>
          </div>
          <div className="badge-note">ongoing archive</div>
        </div>
        <div className="grid-three">
          {posts.slice(1, 4).map((post) => <PostCard key={post.slug} post={post} />)}
        </div>
      </section>

      {/*
        Build section — temporarily disabled while we plan specifics.
        Restore by uncommenting. Data lives in src/content/build.js.

        <section id="build" className="container section-space">
          <div className="section-head with-badge">
            <div>
              <SectionLabel>build</SectionLabel>
              <h2 style={{ fontSize: 'clamp(1.2rem, 3vw, 2rem)' }}>{build.headline}</h2>
              <p>{build.subhead}</p>
            </div>
            <div className="badge-note">in progress, always</div>
          </div>
          <div className="build-grid">
            {build.cards.map((card) => (
              <Paper
                key={card.num}
                tone={card.num === 'i' ? 'paper-yellow' : card.num === 'ii' ? 'paper-blue' : 'paper-coral'}
                className="build-card"
              >
                <span className="build-num">{card.num}</span>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
                <div className="tag-row">
                  {card.tags.map((tag) => <span key={tag} className="tag-pill">{tag}</span>)}
                </div>
              </Paper>
            ))}
          </div>
          <div className="build-note">{build.note}</div>
        </section>
      */}

      <section className="container section-space">
        <div className="section-head">
          <div style={{ maxWidth: 'none' }}>
            <SectionLabel tone="sky">work</SectionLabel>
          </div>
        </div>
        <div className="split-grid work-grid">
          <div className="stack-list">
            {roles.map((role) => (
              <Paper key={role.company} tone={role.color} className="now-bg now-bg-work">
                <span className="now-bg-art" aria-hidden="true" />
                <div className="role-head">
                  <h3>{role.company}</h3>
                  <span className="date-pill">{role.period}</span>
                </div>
                <div className="role-title">{role.title}</div>
                <p>{role.note}</p>
                <div className="tag-row">
                  {role.tags.map((tag) => <span key={tag} className="tag-pill">{tag}</span>)}
                </div>
              </Paper>
            ))}
          </div>
          <div className="side-stack">
            <Paper tone="paper-yellow" className="now-bg now-bg-chart">
              <span className="now-bg-art" aria-hidden="true" />
              <div className="mini-note">quick numbers</div>
              {metrics.map(([value, label]) => (
                <div key={value} className="metric-row">
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </Paper>
          </div>
        </div>
      </section>

      <section className="container section-space">
        <Paper className="contact-blended" tone="paper-yellow">
          <div className="contact-blended-inner">
            <div className="contact-blended-left">
              <div className="mini-note gold">say hello</div>
              <h2 style={{ fontSize: 'clamp(1rem, 2.5vw, 1.7rem)', marginBottom: '1.5rem' }}>I like thoughtful messages, strange observations, and good conversations.</h2>
              <p>
                This could be about work, writing, a role, a collaboration, a personal note on something I wrote, or just a shared curiosity about how weirdly human everything turns out to be.
              </p>
            </div>
            <div className="contact-blended-right">
              <img className="contact-bitmoji" src="/bitmoji-hmu.png" alt="Shubham bitmoji holding HMU sign" />
              <a className="contact-link white-link" href={site.cal} target="_blank" rel="noopener noreferrer">book a 15-min call →</a>
              <a className="contact-link ghost-link" href={site.linkedin}>connect on LinkedIn</a>
              <a className="contact-link ghost-link" href={`mailto:${site.email}`}>send an email</a>
              <p className="contact-note">LinkedIn is fast. Email is better for longer thoughts. Either way, formality is optional. Got an idea you want to think out loud? Fifteen minutes usually finds the next step.</p>
            </div>
          </div>
        </Paper>
      </section>
    </main>
  );
}
