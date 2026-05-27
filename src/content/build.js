// Placeholder structure for the homepage /build section.
// Replace these with specific things you've built when ready.
// The shape is intentionally three buckets, each with 1-2 sentences and a small tag set.

export const build = {
  headline: 'What I build, when the problem gets real.',
  subhead:
    'Three buckets. The specifics are still in draft — these are the shapes the work tends to take.',
  cards: [
    {
      num: 'i',
      title: 'AI systems that do real work',
      body:
        'Agents and copilots wired into real pipelines, not demos. Tool surfaces designed for the model to use without supervision; evals that catch the regressions that matter.',
      tags: ['claude code', 'mcp', 'tool use', 'evals', 'prompt caching'],
    },
    {
      num: 'ii',
      title: 'AI-native security platforms',
      body:
        'Threat-intel pipelines that survive a Tuesday. Correlation engines, knowledge graphs, alert enrichment — the systems that turn signal-noise into something an analyst can act on.',
      tags: ['threat intel', 'knowledge graph', 'cypher', 'correlation', 'soc tooling'],
    },
    {
      num: 'iii',
      title: 'Platforms engineers trust under load',
      body:
        'The boring infrastructure layer: search at scale, ingestion pipelines, observability that earns its place, and the operational habits that keep small teams from being woken up.',
      tags: ['kubernetes', 'postgres', 'opensearch', 'github actions', 'observability'],
    },
  ],
  note:
    'TODO: replace these buckets with specific projects (with links, screenshots, or short writeups). The structure can stay; the contents are deliberately generic for now.',
};
