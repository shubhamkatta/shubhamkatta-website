import { Link } from 'react-router-dom';
import { caseStudies } from '../content/caseStudies';
import { posts } from '../content/posts';
import { chips, findings, metrics, roles, site } from '../content/site';
import { CaseCard, Chip, Paper, PostCard, SectionLabel } from '../components/Shared';

export function HomePage() {
  return (
    <main>
      <section className="hero container split-grid">
        <div>
          <div className="chip-row">
            {chips.map((chip, i) => (
              <Chip key={chip} tone={['paper-white', 'paper-yellow', 'paper-blue', 'paper-coral'][i % 4]}>
                {chip}
              </Chip>
            ))}
          </div>
          <Paper className="hero-card">
            <SectionLabel>personal internet space</SectionLabel>
            <h1 style={{ marginBottom: '1.5rem' }}>A personal space for work, writing, humour, and whatever else survives being noticed.</h1>
            <p className="lead">
              Hi, I’m Shubham. I build software professionally, think about people a little too much, and write about systems, identity, work, the internet, and the odd patterns hiding inside ordinary life.
            </p>
            <p>
              This is less a formal website and more a living archive — part notebook, part portfolio, part internet home, part place where I try to say certain things honestly before they become too polished to mean anything.
            </p>
            <div className="button-row">
              <Link to="/writing" className="button button-primary">read the writings</Link>
              <Link to="/about" className="button button-soft">meet the human</Link>
              <Link to="/work" className="button button-blue">yes, there is work too</Link>
            </div>
          </Paper>
        </div>
        <Paper className="bio-card tape" tone="paper-yellow">
          <div className="badge-note hello-badge">hello, internet</div>
          <div className="bio-hero">
            <img className="bitmoji" src="/bitmoji-relax.png" alt="Shubham bitmoji reading with a cat" />
            <div>
              <SectionLabel tone="ink">currently</SectionLabel>
              <h2>building things, collecting patterns, staying curious</h2>
            </div>
          </div>
          <p>
            Principal engineer by job title, pattern collector by default setting. Equal interest in systems, people, incentives, and why some truths arrive wearing jokes.
          </p>
          <div className="stack-list">
            <Paper tone="paper-white">thinks deeply about systems and human behavior</Paper>
            <Paper tone="paper-blue">writes essays, notes, personal journeys, and casual findings</Paper>
            <Paper tone="paper-coral">wanted this site to feel alive, not laminated</Paper>
          </div>
        </Paper>
      </section>

      <section className="container split-grid compact-top">
        <Paper className="about-home" tone="paper-white">
          <div className="badge-note about-badge">me, but with paragraphs</div>
          <SectionLabel tone="sky">me</SectionLabel>
          <h2>I like people who think clearly, write honestly, and don’t confuse depth with heaviness.</h2>
          <p>
            I’m interested in the gap between what people say, what they do, what they avoid, and the stories they tell themselves about all three. A surprising amount of work, identity, ambition, and love seems to live there.
          </p>
          <p>
            So yes, this site will have software. But it will also have personal experiences, strange realizations, casual findings, internet rabbit holes, and bits of humour that usually show up when truth gets tired of dressing formally.
          </p>
          <Link to="/about" className="text-link">read more about me →</Link>
        </Paper>
        <div className="side-stack">
<Paper tone="paper-yellow">
            <div className="mini-note">from the notebook</div>
            <p>“Humour usually tells the truth faster than seriousness, mostly because it doesn’t have the stamina to keep pretending.”</p>
          </Paper>
        </div>
      </section>

      <section className="container section-space">
        <div className="section-head with-badge">
          <div>
            <SectionLabel>writings</SectionLabel>
            <h2>Essays, notes, personal journeys, and thoughts that refused to stay private.</h2>
          </div>
          <div className="badge-note">ongoing archive</div>
        </div>
        <div className="grid-three">
          {posts.slice(0, 3).map((post) => <PostCard key={post.slug} post={post} />)}
        </div>
      </section>

      <section className="container section-space">
        <Paper className="findings-block ink-block" tone="ink-block">
          <div className="section-head with-badge light">
            <div>
              <SectionLabel tone="light">casual findings</SectionLabel>
              <h2>Some thoughts I’ve probably earned the right to overstate.</h2>
            </div>
            <div className="badge-note dark">collected in real time</div>
          </div>
          <div className="grid-two">
            {findings.slice(0, 4).map((item, idx) => (
              <div key={item} className={`finding-card ${idx % 2 ? 'finding-gold' : 'finding-dark'}`}>
                <div className="finding-label">finding 0{idx + 1}</div>
                <div>{item}</div>
              </div>
            ))}
          </div>
        </Paper>
      </section>

      <section className="container section-space">
        <div className="section-head">
          <div>
            <SectionLabel tone="sky">work</SectionLabel>
            <h2 style={{ fontSize: '0.9rem' }}>The professional chapter. Important, but not the whole autobiography.</h2>
            <p>I do serious work and care about doing it well. I just don’t want the website to behave as though a person is only the cleanest version of their timeline.</p>
          </div>
        </div>
        <div className="split-grid work-grid">
          <div className="stack-list">
            {roles.map((role) => (
              <Paper key={role.company} tone={role.color}>
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
            <Paper tone="paper-yellow">
              <div className="mini-note">quick numbers</div>
              {metrics.map(([value, label]) => (
                <div key={value} className="metric-row">
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </Paper>
            <Paper tone="paper-white">
              <SectionLabel>case files</SectionLabel>
              <div className="stack-list compact">
                {caseStudies.map((item) => <CaseCard key={item.slug} item={item} />)}
              </div>
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
              <a className="contact-link white-link" href={site.linkedin}>connect on LinkedIn</a>
              <a className="contact-link ghost-link" href={`mailto:${site.email}`}>send an email</a>
              <p className="contact-note">LinkedIn is fast. Email is better for longer thoughts. Either way, formality is optional.</p>
            </div>
          </div>
        </Paper>
      </section>
    </main>
  );
}
