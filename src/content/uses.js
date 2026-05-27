export const uses = {
  intro:
    'A working inventory of the hardware and software on (and around) my desk. Updated when something earns its keep — or quietly disappears.',
  lastUpdated: 'May 27, 2026',
  sections: [
    {
      key: 'machine',
      title: 'machine',
      tone: 'paper-white',
      items: [
        { name: 'MacBook Pro 14"', detail: 'M4 Pro', context: 'main machine, day in, day out. The Intel that came before taught me patience.' },
        { name: 'PLIXIO laptop stand', detail: 'silver · 360° rotating base · foldable', context: 'lifts the MacBook to eye level on travel days; folds flat for the bag.' },
      ],
    },
    {
      key: 'screens',
      title: 'screens',
      tone: 'paper-yellow',
      items: [
        { name: 'LG 27GL650F', detail: '27" 1080p IPS · primary', context: 'fast-enough panel; mostly carries the code and the prose.' },
        { name: 'Dell E2420HS', detail: '24" 1080p · secondary', context: 'docs, Slack, and the things I do not want crowding the main screen.' },
        { name: 'Rife dual monitor mount', detail: 'gas spring · VESA 75 / 100', context: 'cleared half the desk overnight. The cheapest upgrade I made all year.' },
      ],
    },
    {
      key: 'input',
      title: 'input',
      tone: 'paper-blue',
      items: [
        { name: 'Logitech G keyboard', detail: 'mechanical · backlit', context: 'tactile and forgiving. No, I do not play games on it.' },
        { name: 'HP Spectre mouse', detail: 'wireless', context: 'small, quiet, stays out of the way — which is the whole job.' },
        { name: 'Turf 2.0 felt desk mat', detail: 'grey · keyboard + mouse zone', context: 'looks like a notebook page. Sounds like one too.' },
      ],
    },
    {
      key: 'audio-camera',
      title: 'audio + camera',
      tone: 'paper-coral',
      items: [
        { name: 'Sony WH-1000XM4', detail: 'over-ear · ANC', context: 'crowded cafes, long flights, the occasional late edit.' },
        { name: 'eMeet S600', detail: '4K · Sony 1/2.5" sensor · PDAF', context: 'focuses on me instead of the lamp. Low bar; most webcams miss it.' },
      ],
    },
    {
      key: 'power',
      title: 'power',
      tone: 'paper-white',
      items: [
        { name: 'Cadyce USB hub', detail: 'one cable to the laptop', context: 'everything else stays plugged. Coffee runs stop being reset rituals.' },
        { name: 'SURGE 3-in-1 charger', detail: 'Qi2 · MagSafe · phone + watch + earbuds', context: 'one pad, three devices, one less cable I have to find at midnight.' },
      ],
    },
    {
      key: 'frame',
      title: 'frame',
      tone: 'paper-yellow',
      items: [
        { name: 'Green Soul Vision', detail: 'ergonomic chair', context: 'the upgrade I should have done two years earlier.' },
        { name: 'Custom-built table', detail: 'made to the exact width I wanted', context: 'standing desks are oversold. A well-sized fixed desk is underrated.' },
        { name: 'ErgoFoam foot rest', detail: 'velvet · rocker · under-desk', context: 'small thing, weirdly noticeable in week two — knees and lower back stopped reminding me they were there.' },
      ],
    },
    {
      key: 'software',
      title: 'software',
      tone: 'paper-blue',
      items: [
        { name: 'Claude Code', detail: 'Max plan · daily driver', context: 'the editor I open first and close last. Agent in the loop is the IDE now.' },
        { name: 'JetBrains IDE', detail: 'IntelliJ / PyCharm flavour', context: 'for the heavy refactors where smart-aware navigation pays back the wait.' },
        { name: 'Cursor', detail: 'occasionally, for long refactors', context: 'composer mode when the codebase is unfamiliar enough that I want a navigator.' },
        { name: 'iTerm2', detail: 'still, yes', context: 'I switched to alternatives for a week each. I switched back each time.' },
        { name: 'Obsidian', detail: 'plain-text vault, synced via iCloud', context: 'notes that outlive the device they were taken on.' },
        { name: 'Bitwarden', detail: 'secrets + SSH keys', context: 'the tool I trust to be opinionated about my mistakes.' },
        { name: 'Apple Notes', detail: 'for the 60-second thought', context: 'low ceremony, low fidelity, high reach.' },
      ],
    },
    {
      key: 'off-screen',
      title: 'off-screen',
      tone: 'paper-coral',
      items: [
        { name: 'New parenthood', detail: 'my Whoop keeps recommending Vitamin Sleep', context: 'turns out the old advice was always right; the messenger just got more polite about it.' },
        { name: 'Daily liquids', detail: 'aeropress in the morning · ginger masala mid-day · the occasional beer to close', context: 'three different beverages, three different attention states. The order matters more than the dose.' },
        { name: 'Volkswagen Virtus GT', detail: 'the steering-wheel cure', context: 'speed, thrill, and an honest excuse to drive somewhere I do not strictly need to be.' },
        { name: 'Zomato', detail: 'order frequency: quietly a thing', context: 'I cook fine. I order more. The grocery list keeps asking for an audit.' },
        { name: 'Treadmill', detail: '35 minutes, most days', context: 'the only cardio that finally stuck. The resting heart-rate trend line is being polite about it.' },
      ],
    },
  ],
};
