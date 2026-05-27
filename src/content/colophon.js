export const colophon = {
  intro:
    'How this corner of the internet is put together — the type, the palette, the rules I bent, and the people I borrowed from. Less a manifesto, more a margin note.',
  sections: [
    {
      key: 'type',
      title: 'type',
      tone: 'paper-white',
      items: [
        {
          name: 'Inter',
          font: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
          detail: 'body + navigation · system-ui fallback',
          context: 'does the boring work and never asks for credit. The compliment a body face actually wants.',
        },
        {
          name: 'Caveat',
          font: '"Caveat", "Marker Felt", "Comic Sans MS", cursive',
          detail: 'handwritten labels, arrows, mini-notes',
          context: 'where a sticky note would have gone if this were a paper notebook. Used to mark the margins, not the headlines.',
        },
        {
          name: 'Fraunces',
          font: '"Fraunces", "Iowan Old Style", Georgia, ui-serif, serif',
          detail: 'the "currently" snapshot on /now',
          context: 'a serif with a small smirk. Reserved for the lines I want to feel slightly dressed up.',
        },
        {
          name: 'ui-monospace',
          font: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          detail: 'code blocks + inline snippets',
          context: 'whatever your OS thinks code should look like — I trust your machine more than my opinion here.',
        },
      ],
    },
    {
      key: 'palette',
      title: 'palette',
      tone: 'paper-yellow',
      items: [
        {
          name: 'Warm cream',
          swatch: '#fff8ef',
          detail: '#fff8ef · light-mode ground',
          context: 'closer to old paper than to white. White was too clinical for a personal site.',
        },
        {
          name: 'Near-black ink',
          swatch: '#1d1815',
          detail: '#1d1815 · primary text',
          context: 'not pure black. Pure black on cream prints louder than the room can hold.',
        },
        {
          name: 'Coral red',
          swatch: '#ff6b6b',
          detail: '#ff6b6b · one accent, used carefully',
          context: 'links, active nav, the giant pull-quote mark. When everything is highlighted nothing is, so I let red mean something.',
        },
        {
          name: 'Library at midnight',
          swatch: '#1a1612',
          detail: 'dark mode · #1a1612 ground, #f3ead8 text',
          context: 'warm brown floor, faded-paper text. The deliberate opposite of a grey dashboard.',
        },
      ],
    },
    {
      key: 'principles',
      title: 'principles',
      tone: 'paper-blue',
      items: [
        {
          name: 'Made as an interaction, not an obligation',
          detail: '',
          context: 'this site exists because I wanted to make it, not because a job posting asked for it. The day that flips is the day it stops being honest.',
        },
        {
          name: 'Asymmetry, on purpose',
          detail: '',
          context: 'cards tilt. The grid stays straight. That contrast is the whole trick.',
        },
        {
          name: 'One accent, used rarely',
          detail: '',
          context: 'red is reserved for "look here". The moment it spreads, it stops working.',
        },
        {
          name: 'lowercase headings',
          detail: '',
          context: 'the site is talking, not shouting. That is the whole tone in one rule.',
        },
      ],
    },
    {
      key: 'debts',
      title: 'debts',
      tone: 'paper-yellow',
      items: [
        {
          name: 'Claude Code + OpenAI',
          detail: 'the pair behind the late-night keyboard',
          context: 'for reading what I was actually trying to say, and helping shape this warm-paper feel. PS: 37 iterations before it landed the way I wanted it.',
        },
        {
          name: 'Prince Vishal’s site',
          detail: '',
          context: 'for making me aware that /uses, /colophon, and /now were even a thing worth having.',
        },
      ],
    },
  ],
};
