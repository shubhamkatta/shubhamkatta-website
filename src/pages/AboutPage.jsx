import { Paper, SectionLabel } from '../components/Shared';

export function AboutPage() {
  return (
    <main className="container page-space narrow-grid">
      <Paper tone="paper-white">
        <SectionLabel tone="sky">me</SectionLabel>
        <h1 style={{ fontSize: 'clamp(1.35rem, 4vw, 2.9rem)', marginBottom: '1.5rem' }}>More internet room, less corporate lobby.</h1>
        <p style={{ marginBottom: '2rem' }}>
          I'm interested in the gap between what people say, what they do, what they avoid, and the stories they tell themselves about all three. A surprising amount of work, identity, ambition, and love seems to live there.
        </p>
        <p>
          I build systems for a living, but I'm equally interested in the human machinery around them — incentives, judgment, ambiguity, communication, and the stories people tell themselves when the metrics are fine but something still feels off.
        </p>
        <p>
          The earlier version of this site described me as a modern-day digital professional, part-time entrepreneur, and someone constantly around evolving people and brands. That spirit still belongs here, even if the language has become cleaner and the typography has stopped shouting. I still care about brand, behavior, business context, and what happens when the internet starts influencing how people see themselves. That thread runs through the whole site. 
        </p>
      </Paper>
      <div className="side-stack">
        <Paper tone="paper-coral">
          <SectionLabel tone="ink">what stays true</SectionLabel>
          <p>I write like a person. I like humour. I do not trust over-sanitised self-presentation.</p>
        </Paper>
        <Paper tone="paper-yellow">
          <SectionLabel tone="ink">things I keep returning to</SectionLabel>
          <ul className="simple-list">
            <li>systems and incentives</li>
            <li>digital identity and reputation</li>
            <li>work, ambition, and self-deception</li>
            <li>personal honesty without performative heaviness</li>
          </ul>
        </Paper>
      </div>
    </main>
  );
}
