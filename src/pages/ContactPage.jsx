import { site } from '../content/site';
import { Paper, SectionLabel } from '../components/Shared';
import { useSEO } from '../components/useSEO';
import { contactSeo } from '../content/seo';

export function ContactPage() {
  useSEO(contactSeo);
  return (
    <main className="container page-space">
      <div className="contact-grid">
        <Paper className="contact-copy" tone="paper-white">
          <SectionLabel>say hello</SectionLabel>
          <h1 style={{ fontSize: 'clamp(1.35rem, 4vw, 2.9rem)', marginBottom: '1.5rem' }}>
            I like thoughtful messages, strange observations, and good conversations.
          </h1>
          <p style={{ marginBottom: '2rem' }}>
            This could be about work, writing, a role, a collaboration, a personal note on something
            I wrote, or just a shared curiosity about how weirdly human everything turns out to be.
          </p>
        </Paper>
        <Paper className="contact-card" tone="paper-red-block">
          <img className="contact-bitmoji" src="/bitmoji-hmu.png" alt="Shubham bitmoji holding HMU sign" />
          <a className="contact-link white-link" href={site.linkedin}>connect on LinkedIn</a>
          <a className="contact-link ghost-link" href={`mailto:${site.email}`}>send an email</a>
          <p>LinkedIn is fast. Email is better for longer thoughts. Either way, formality is optional.</p>
        </Paper>
      </div>

      <section className="section-space cal-cta-section" style={{ marginTop: '1.5rem' }}>
        <div className="cal-cta-copy">
          <SectionLabel>book a call</SectionLabel>
          <h2 style={{ fontSize: 'clamp(1.2rem, 3vw, 1.8rem)' }}>
            Or, if you'd rather just pick a slot.
          </h2>
          <p>Fifteen minutes. Bring a conversation, not a deck.</p>
        </div>
        <a
          href={site.cal}
          target="_blank"
          rel="noopener noreferrer"
          className="cal-cta-button"
          aria-label="Book a 15-minute call on Cal.com"
        >
          <span className="cal-cta-label">book 15 minutes</span>
          <span className="cal-cta-arrow" aria-hidden="true">→</span>
        </a>
      </section>
    </main>
  );
}
