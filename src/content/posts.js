export const posts = [
  {
    slug: 'some-truths-arrive-wearing-jokes',
    cover: '/blog/cover-truths-jokes.svg',
    title: 'Some truths arrive wearing jokes',
    type: 'observation',
    date: 'November 19, 2025',
    readingTime: '5 min',
    color: 'paper-yellow',
    tags: ['humour', 'honesty', 'culture'],
    excerpt:
      'Humour gets away with things seriousness cannot. That is why jokes survive where honest sentences get rejected.',
    seoDescription:
      'Why a well-timed joke can expose a culture, a relationship, or a meeting faster than polished language ever will — and where the line is.',
    keywords: 'humour, honesty, communication, culture, comedy, candor',
    intro:
      `Humour gets away with things seriousness cannot. It can enter a room without being announced. It can tell the truth before people have prepared their defenses.\n\nThat is why jokes often survive where honest sentences get rejected. A well-timed joke can expose a culture, a relationship, or a meeting faster than polished language ever will.`,
    sections: [
      {
        heading: 'the joke as a side door',
        body: `Honest sentences usually have to go through the front door. They get inspected, doubted, and softened on the way in. By the time they reach the room, half the truth has been confiscated.\n\nA joke comes in through the side door. Nobody is checking. The audience laughs, then realises a second later what they were laughing at. By then it is too late to disagree. The truth has already arrived.\n\nThis is why so much actual feedback in organisations travels through humour. The line "anyway, the planning is a vibe at this point" carries an entire critique that nobody could have said in plain language without a meeting about it.`,
      },
      {
        heading: 'why polished sentences get rejected',
        body: `A polished sentence asks for an answer. A joke does not. The audience can laugh and not be on record agreeing.\n\nThis ambiguity is what makes humour socially survivable. It also limits its reach. A joke can illuminate something. It rarely fixes anything by itself. The room laughs, the truth is named, and then nothing happens — until someone, eventually, says it without the joke.\n\nThe joke buys a few weeks of grace. After that, the room's permission to ignore the truth slowly returns.`,
      },
      {
        heading: 'the kind of humour that isn\'t honesty',
        body: `Not all humour does this work. There is humour that is just cruelty in costume. There is humour that flatters the audience. There is humour that adds noise without naming anything.\n\nThe useful kind has a specific shape: it points at something that everyone already privately thinks, but nobody had said out loud. The laugh is the recognition. If a joke is funny mostly because someone is being made smaller, it is doing something else.`,
      },
      {
        heading: 'things I\'ve learned to say with a joke first',
        body: `In rooms where the temperature is high, I have stopped trying to lead with the careful sentence. I lead with the joke that names the thing, then — only if the room invites it — follow with the sentence. The joke makes the sentence possible.\n\nThis is not deception. It is just respecting the way attention moves. The joke creates a small permission. The sentence steps through it.`,
      },
      {
        heading: 'when the joke isn\'t enough',
        body: `Some truths cannot be said as a joke. Anything involving harm, anything involving someone's safety or dignity, anything that requires an actual decision to be made — those need plain sentences, in private, on the record. Jokes about them are usually a way of declining to do the harder thing.\n\nThe rule of thumb: humour is a great instrument for **naming** truth. It is a poor instrument for **enforcing** it. If the situation requires enforcement, do not hide behind a laugh.`,
      },
      {
        heading: 'the line worth keeping',
        body: `Funny is not honest. Funny that lands is.\n\nA joke that names something true gets remembered. A joke that just performs being clever evaporates by the end of the call. The difference is mostly whether the audience felt seen by the joke, or merely entertained.\n\nWhen in doubt, ask: would the version of me without the audience still find this true? If yes, the joke is doing real work. If not, it is just decoration.`,
      },
    ],
  },

  {
    slug: 'claude-code-in-production-a-field-guide',
    cover: '/blog/cover-claude-code-production.svg',
    title: 'Claude Code, in production: a field guide',
    type: 'field notes',
    date: 'November 11, 2025',
    readingTime: '12 min',
    color: 'paper-yellow',
    tags: ['claude code', 'production', 'workflow'],
    excerpt:
      'Eight months of Claude Code on a real codebase. The boring habits that keep things from breaking on a Friday afternoon.',
    seoDescription:
      'Practical patterns for using Claude Code in production codebases — CLAUDE.md, permissions, hooks, slash commands, MCP, and the small habits that prevent regressions.',
    keywords: 'Claude Code production, CLAUDE.md, permissions, hooks, slash commands, MCP, real codebase',
    intro:
      `I have been using Claude Code on a real, busy codebase for the better part of a year. The honest summary: it is a force multiplier when configured well, an unpredictable intern when not. The difference is mostly in the configuration files and the small habits, not the model.\n\nThis is the field guide. Not a hype piece. Things that have actually held up.`,
    sections: [
      {
        heading: 'CLAUDE.md is your contract',
        body: `The most-read document Claude has on your project is \`CLAUDE.md\`. It is loaded on every turn. Treat it like a contract between you and the agent.\n\nThings worth putting in:\n\n- the dev/test/lint commands\n- code conventions that are not visible from the code (e.g. "we never use \`any\` in TypeScript; if you reach for it, you have missed a type")\n- the deploy story, in two sentences\n- anything that would surprise a new contributor\n- "do not" rules that have bitten people before\n\nThings to leave out:\n\n- code that is in the codebase\n- detailed architecture you can derive from the code itself\n- "philosophy" that does not change behaviour\n\nThe rule of thumb: if removing a line from CLAUDE.md would not change Claude's actions, the line is not earning its place.`,
      },
      {
        heading: 'Permissions: deny first, then earn',
        body: `Default Claude Code permissions are fine for a quick task. They are too permissive for a shared production project.\n\nThe shape that has held up for me:\n\n- **deny** anything destructive without confirmation: \`rm -rf:*\`, \`git push --force:*\`, \`git reset --hard:*\`\n- **allow** read-only investigation: \`git status\`, \`git diff:*\`, \`ls:*\`, \`rg:*\`, \`cat:*\` (limited paths)\n- **allow** the project's test and lint commands\n- prompt for everything else\n\nSetting this in the team's \`.claude/settings.json\` and committing it means everyone on the project gets the same speedbumps in the same places. New teammate onboarding becomes "git pull" rather than "ask Slack what to allow."`,
      },
      {
        heading: 'Hooks I run on every project',
        body: `Three hooks, each small:\n\n- \`PostToolUse\` on \`Edit|Write\` runs the formatter. The formatter handles its own complaints.\n- \`PreToolUse\` on \`Bash\` greps for force-push to protected branches and exits non-zero. The hook is the only way to make this rule structurally true.\n- \`Stop\` fires a desktop notification. Long tasks plus tab-switching equal "wait, when did this finish?" The Stop hook fixes that.\n\nThis is also covered in [the hooks post](/writing/claude-code-hooks-slash-commands-and-settings) if you want the JSON.`,
      },
      {
        heading: 'Skills I actually use',
        body: `\`/review\`, \`/security-review\`, \`/ship-pr\`, \`/loop\`, \`/init\`. Plus two project-specific ones:\n\n- \`/audit-tenant\` — checks every changed query for tenant-scope filters; this codebase has been bitten by missing tenant filters in the past, so the skill is a literal contract\n- \`/migrate-config\` — handles a recurring config migration we do every few weeks; less interesting than \`/audit-tenant\`, more frequently used\n\nThe pattern: generic skills are starting points. The skills that pay back are the ones tied to your project's history.`,
      },
      {
        heading: 'MCP servers that earn their keep',
        body: `Claude Code can connect to MCP servers. The servers that have held up on this project:\n\n- a thin Postgres server with **read-only** access for ad-hoc questions\n- our internal threat-intel server (covered in [Three MCP servers I built](/writing/mcp-servers-i-built-and-what-they-taught-me))\n- the GitHub server for issue/PR context\n\nWhat did not last:\n\n- a server that wrapped our deploy tool — too risky, easy to misuse, demoted to a documented runbook\n- a server with too-wide tools — replaced with narrower tools that the agent picked correctly more often\n\nThe rule of thumb: if your MCP server lets the agent do things you would not let an intern do unsupervised, you have not built a server, you have built a hole.`,
      },
      {
        heading: 'The Friday afternoon test',
        body: `My informal test for whether a tool, skill, or hook is "production ready":\n\n> If this fires unexpectedly at 4pm on a Friday, while I am two beers in at a friend's place, will I be glad it exists?\n\nIt is a stupid little heuristic. It catches a lot. Anything that auto-commits, auto-pushes, auto-merges, or auto-DMs the team fails the test. Anything read-only, anything reversible, anything that surfaces information instead of taking action, passes.\n\nProduction is mostly Friday afternoon, statistically. Build for it.`,
      },
      {
        heading: 'Things people learn the hard way',
        body: `- **Do not skip hooks with --no-verify.** If a pre-commit hook fails, the right answer is to fix the underlying issue. The wrong answer is to bypass it. Treat hook bypass like silencing a smoke alarm.\n- **Do not amend pushed commits.** Creating new commits is reversible; rewriting shared history is not.\n- **Verify before deleting.** Unfamiliar files might be the user's in-progress work. "I'll just clean this up" is the most dangerous sentence in version control.\n- **Watch for context bloat.** When the agent feels slower or more vague, the prompt has probably grown without you noticing. Trim.\n\nNone of these are surprising. All of them have caught me at least once.`,
      },
      {
        heading: 'A short list of things I would not skip on a new project',
        body: `1. Write a starter CLAUDE.md. \`/init\` does most of the work.\n2. Commit a tight \`.claude/settings.json\` with permissions and the format-on-edit hook.\n3. Add \`/review\`, \`/ship-pr\`, and \`/security-review\` to the project's slash commands.\n4. Hook up the read-only MCPs you actually use.\n5. Don't add anything else until something breaks.\n\nThe minimal setup beats the maximalist setup, every time. You can always add. Removing is harder once a teammate is depending on it.`,
      },
    ],
  },

  {
    slug: 'why-systems-fail-quietly',
    cover: '/blog/cover-systems-fail-quietly.svg',
    title: 'Why systems fail quietly',
    type: 'observation',
    date: 'November 6, 2025',
    readingTime: '7 min',
    color: 'paper-coral',
    tags: ['systems', 'organizations', 'leadership'],
    excerpt:
      'Failure usually arrives politely. By the time the real break happens, the system has been asking for help for months.',
    seoDescription:
      'Most systems do not collapse dramatically. They lose clarity first. A close look at the quiet warnings and the patterns we are taught to ignore.',
    keywords: 'systems thinking, organisational failure, leadership, dysfunction, dashboards, technical debt',
    intro:
      `Most systems do not collapse dramatically. They lose clarity first. A team stops asking basic questions. A dashboard begins to look more reassuring than useful. The same two people become the unofficial memory of the project.\n\nFailure usually arrives politely. It comes dressed as minor delays, workarounds, and the growing normalcy of confusion. By the time the real break happens, the system has been asking for help for months.`,
    sections: [
      {
        heading: 'the first warning is loss of clarity',
        body: `Healthy systems generate clarity as a side effect. People know what they are responsible for. New joiners can find their way without an oracle. Decisions made last quarter are still findable.\n\nThe first sign of decay is that this stops being true. Not all at once. The questions get a little vaguer. The answers depend on who you ask. The doc that used to explain how the thing worked is still there, but everyone knows it is out of date and nobody has rewritten it.\n\nThis is the warning. People rarely treat it like one because nothing is on fire.`,
      },
      {
        heading: 'reassuring dashboards',
        body:
`The most dangerous dashboard is the one that is mostly green. It looks fine. It tells you what you wanted to hear. It is, at the same time, ignoring the thing that is actually breaking.\n\nReassuring dashboards happen because the metrics were chosen by the people who would be embarrassed by the bad ones. Over time, the dashboard becomes a curated comfort instead of an instrument. It tells you the things going well, and quietly stops measuring the things that could expose someone.\n\nA good test: when the dashboard is most green, are people internally most calm? If the answer is "no, actually we are tense," your dashboard is lying to you.`,
      },
      {
        heading: 'the unofficial memory',
        body: `In every quietly-failing system, there are usually two people who are the unofficial memory. They know the history. They know who actually owns the gnarly thing. They know where the bodies are.\n\nThis sounds useful. It is, on day one. It is catastrophic by year three.\n\nWhen institutional knowledge lives in two heads, the system has effectively single-pointed itself. If those two people leave, the system loses its history overnight. The cost is not just turnover. It is the long, slow rebuild of context that nobody had documented because the two people were always there.`,
      },
      {
        heading: 'the four signs we were taught to ignore',
        body:
`Most teams have been trained to overlook the early warnings.\n\n![Four quiet warnings, each easy to miss in isolation, dangerous in aggregate.](/blog/diagram-quiet-warnings.svg)\n\nIn isolation, none of these would alarm anyone. In combination, they are the early stages of system rot. The reason they go unaddressed is that fixing any one of them is unrewarding political work, while ignoring all of them looks like normal busyness.\n\nThe shorthand version, in case it helps:\n\n- people stop asking basic questions in meetings, because asking them now feels embarrassing\n- workarounds get repeated often enough to become "how we do things"\n- new joiners need a specific person to get unstuck on tasks that should be self-serve\n- everyone is busy, and nobody can clearly say what they shipped last quarter`,
      },
      {
        heading: 'what to do when you notice the pattern',
        body: `Three useful moves, in order of cost:\n\n- **make the invisible visible.** Document one critical workflow that currently lives in someone's head. The act of writing it down forces a conversation about what is actually true.\n- **introduce a "dumb question" norm.** Make it explicitly safe to ask the basic question. The person who asks it is doing the team a service. Reward it.\n- **invite a stranger.** Get someone outside the system to walk through a flow with you. Their confusion will surface gaps your team has been quietly stepping over for months.\n\nNone of these are heroic. All of them work. The trick is to do them while the system is still mostly fine, because once it is on fire, you no longer have the slack to do them at all.`,
      },
      {
        heading: 'the quiet ones are the dangerous ones',
        body: `Loud failures are rare. They get attention, resources, and post-mortems. The system that fails loudly often recovers.\n\nThe dangerous failures are the ones that look like normal life until they don't. They take longer to surface, they accumulate larger blast radius, and by the time anyone names them, the muscle memory of looking the other way is so strong that the naming itself feels rude.\n\nThe most useful thing you can do for a system you care about is to be the person who points at the quiet decay before it becomes loud. You will not always be thanked for it. The system will be, eventually, even if it can't say so.`,
      },
    ],
  },

  {
    slug: 'the-psychology-of-work-nobody-adds-to-sprint-planning',
    cover: '/blog/cover-psychology-of-work.svg',
    title: 'The psychology of work nobody adds to sprint planning',
    type: 'observation',
    date: 'November 4, 2025',
    readingTime: '6 min',
    color: 'paper-blue',
    tags: ['work', 'teams', 'psychology'],
    excerpt:
      'Every sprint has visible tasks and invisible tensions. The tickets show what the team is building. They rarely show what people are avoiding.',
    seoDescription:
      'On the emotional weather behind project plans — what velocity charts can\'t see, the invisible loads inside every sprint, and how to make some of it visible without making it weird.',
    keywords: 'sprint planning, team psychology, software teams, emotional labour, project management',
    intro:
      `Every sprint has visible tasks and invisible tensions. The tickets show what the team is building. They rarely show what people are avoiding, defending, exaggerating, or silently resenting.\n\nA lot of work is emotional weather pretending to be project management. The velocity chart does not capture hesitation, ego, fear of being exposed, or the small desire to sound right in front of the wrong people.`,
    sections: [
      {
        heading: 'the ticket vs. the tension',
        body: `A ticket says "implement X." The tension is "I disagreed with this design and I'm doing it anyway." A ticket says "fix bug Y." The tension is "this bug is in code I wrote two years ago and reading it now feels personal." A ticket says "review PR Z." The tension is "the author is more senior than me and I'm not sure how candid I'm allowed to be."\n\nNone of these tensions show up in the sprint board. All of them shape how the work actually goes. They are the part the team is paid to navigate but rarely paid to discuss.`,
      },
      {
        heading: 'emotional weather pretending to be project management',
        body:
`If you sit in enough planning meetings, you start to notice that a lot of what gets discussed isn't really about scope or estimation. It is about who feels safe enough to commit to which story, who is privately worried about the quarter, who is using "complexity" to defer something they don't want to admit they don't want to do.\n\n![What the sprint board shows vs what the sprint actually contains.](/blog/diagram-iceberg-work.svg)\n\nNone of this is bad. It is just human. Pretending it isn't there is what makes it dangerous.`,
      },
      {
        heading: 'what velocity charts can\'t see',
        body: `A short list of things the chart misses:\n\n- the day someone decides quietly they are leaving\n- the slow build-up of resentment between two engineers who used to be friends\n- the manager who is privately panicking about a metric and hiding it from the team\n- the staff engineer who is bored and starting to pick fights as a substitute for stimulation\n- the new hire who is technically up to speed and emotionally still drifting\n\nAny one of these affects throughput more than any individual ticket. None of them are estimable in story points.`,
      },
      {
        heading: 'a short list of invisible loads',
        body: `Things people carry into sprints without naming:\n\n- the cost of pretending to like a workflow they think is dumb\n- the cost of being the person who keeps track of things nobody assigned them to\n- the cost of being on a team where the loudest person is also the wrongest, and the team is too tired to push back\n- the cost of small daily dishonesty — "fine," "no concerns," "all good" — accumulating across months\n- the cost of representing the team to leadership in a way that does not match how the team is actually doing\n\nThe tickets do not weigh these. The people are weighing them anyway.`,
      },
      {
        heading: 'making some of it visible without making it weird',
        body: `You cannot turn sprint planning into therapy. You can, however, make small spaces where the invisible stuff is welcome.\n\nThings I have seen work:\n\n- a 5-minute "what is making this sprint heavier than it should be" round, optional, no-judgement\n- the explicit norm that anyone can flag a ticket as "I'm not sure I'm the right person for this," with no follow-up shame\n- 1:1s that are actually 1:1s, not status meetings in disguise\n- naming team-wide patterns out loud, in a meeting, calmly: "we keep doing X. Has anyone else noticed? Is it bothering anyone else?"\n\nThe goal is not to surface every feeling. The goal is to lower the cost of surfacing the few that matter.`,
      },
      {
        heading: 'the fact this exists is not a problem',
        body: `Teams that pretend they have no emotional weather are not more efficient. They are just spending the same energy underground, where it can't be redirected.\n\nMaking some of it visible is not soft. It is operationally cheap and saves entire quarters from being privately wasted. The people who treat this as a distraction from the "real work" tend to be the same people whose teams keep mysteriously losing momentum and never quite figuring out why.\n\nThe weather is the work. It always was.`,
      },
    ],
  },

  {
    slug: 'building-evals-that-dont-lie-to-you',
    cover: '/blog/cover-evals-dont-lie.svg',
    title: 'Building evals that don’t lie to you',
    type: 'deep dive',
    date: 'October 30, 2025',
    readingTime: '11 min',
    color: 'paper-blue',
    tags: ['evals', 'quality', 'testing'],
    excerpt:
      'Aggregate scores are the comfort food of AI engineering. They will mislead you. The fix is small, slow, and worth it.',
    seoDescription:
      'How to design evals for LLM systems that catch real regressions — golden datasets, rule-first grading, LLM-as-judge, disagreement signal, and versioning evals.',
    keywords: 'LLM evals, golden dataset, regression testing, LLM as judge, rule-based grading, eval design, AI quality',
    intro:
      `If you ever shipped a prompt change because "the eval went up," and then someone reported a bug a week later that you would have caught with a slightly different eval — welcome. We have all done it.\n\nGood evals do not promise the model is correct. They promise that **specific failure modes** are not coming back. The cheaper you can make a regression visible, the faster you can ship without breaking the parts you care about.\n\nThis post is about the small craft choices that make evals reliable. None of it is exciting; all of it has held up.`,
    sections: [
      {
        heading: 'The score that lies to you',
        body: `Most teams start with a single eval score: 78%, 82%, 85%. Numbers go up. Confidence rises.\n\nThe problem is that aggregate scores hide the cases you care about. If your eval set is 60% "easy" and 40% "real," and a prompt change improves easy cases by 4 points and breaks real ones by 2, the aggregate goes up. The product gets worse.\n\nThe fix is not to abandon the score. It is to refuse to let the score be the whole story. Slice the score by case category. Track each slice over time. Pay attention to disagreements between slices.`,
      },
      {
        heading: 'A golden dataset is mostly hand-picked failure',
        body: `Most golden datasets are too easy. The model gets them right because they are the cases you remember the model getting right.\n\nThe useful golden dataset is a list of cases you would be embarrassed to ship a regression on. Every time the model fails in the wild, that case becomes a fixture. Every time you find a footgun, that case becomes a fixture. Every time someone shows you a "weird" input, that case becomes a fixture.\n\nThe dataset grows by adding **failure**, not by adding **coverage**. You can have great coverage and still ship regressions on the cases that matter. You cannot have great failure-driven cases and ship regressions on the cases that mattered last quarter — because they are in the eval.`,
      },
      {
        heading: 'Rule checks first',
        body: `Cheap, deterministic checks before anything else:\n\n- did the output contain valid JSON when JSON was expected?\n- did the model call the right tool?\n- did the answer contain a banned phrase?\n- is the answer length within bounds?\n\nThese catch the embarrassing failures fast and free. They also remove a lot of work from your fancier graders. If a case fails the rules, you do not need to ask an LLM judge whether the case "feels right" — you already know.`,
      },
      {
        heading: 'LLM-as-judge: useful but slippery',
        body: `LLM judges are right often enough to be useful and wrong often enough to be dangerous. Three habits keep the danger small:\n\n- **Use a small, fast model.** Haiku-class for the judge. The judge is not where you spend.\n- **Show the rubric.** Do not say "is this good?" Say "is this good according to these three criteria; reply with a JSON verdict and a one-line reason."\n- **Sample-grade your grader.** Once a quarter, hand-grade 30 cases the judge graded, and look at where you disagree. The judge drifts. Your eval should know.\n\nThe biggest practical mistake is using the same model as judge as you are evaluating. The judge tends to flatter the system that thinks like it. If you can use a different model family for the judge, do.`,
      },
      {
        heading: 'Disagreement is a feature, not a bug',
        body: `Two graders that always agree are one grader. The interesting cases are where the rule check says ✓ and the judge says ✗ (or vice versa).\n\nThese disagreements are where you find:\n\n- valid JSON that answered the wrong question\n- the right answer in a forbidden format\n- a tool called correctly but on the wrong entity\n\nDo not paper over disagreement with averaging. Surface it. Read it. Often the case itself is wrong (the rule was too strict, or the rubric was vague), and fixing the case fixes a slow leak in your eval.`,
      },
      {
        heading: 'Version evals, not models',
        body: `Eval results are only meaningful if the eval did not change. So the eval set itself becomes a versioned artifact.\n\nWhat I version:\n\n- the dataset (jsonl in the repo)\n- the rubrics for any LLM-as-judge cases\n- the rule definitions\n- the model used as judge\n\nWhat I do **not** version:\n\n- the model under test (you want to compare runs across model versions)\n- the prompt under test (same reason)\n\nWhen the eval set changes meaningfully, mark a new version. Reports across versions get a "v0.4 → v0.5" annotation. This sounds like overhead until your eval set has been around for six months and someone asks "did this score go up because the prompt got better, or because we removed the ten cases that kept failing."`,
      },
      {
        heading: 'A regression I caught last week',
        body: `A small prompt change. Aggregate went from 81% to 84%. I was about to ship.\n\nThe diff report — only cases that flipped vs the last run — showed:\n\n\`\`\`
+ ticket-014: now passes (was format violation)
+ ticket-019: now passes (better tool selection)
+ ticket-022: now passes (tone)
+ ticket-024: now passes (tone)
- ticket-031: now fails (called update_ticket instead of create_ticket)
- ticket-033: now fails (missing tenant_id arg)
\`\`\`\n\nThe two failures were exactly the kind of mistake that is invisible in aggregate and obvious in diff. The new prompt was more conversational, and the model was leaning on the conversational frame instead of the tool-use frame.\n\nI did not ship. The diff caught what the score hid.\n\n![A made-up but realistic eval slice — aggregate looks fine; the dimensions tell the real story.](/blog/cover-evals-dont-lie.svg)`,
      },
      {
        heading: 'A short list of habits that have held up',
        body: `- save every run; diff against the previous one; the diff is what you read first\n- slice scores by case category; the global number is the last thing you check\n- treat every production failure as a future fixture\n- keep the dataset in the repo; in PRs, eval changes are reviewed like code changes\n- run evals on every prompt change, no exceptions\n- never grade with the same model the prompt is targeting`,
      },
      {
        heading: 'The honest closer',
        body: `Evals are slow, unsexy, and the one thing that lets you ship faster without breaking what works. The teams that "move fast" without them eventually stop moving, because every change becomes a debate about whether it broke something.\n\nThe teams that move fast **with** them argue about evidence instead of feelings. Pick the second kind.`,
      },
    ],
  },

  {
    slug: 'how-to-write-a-claude-code-skill',
    cover: '/blog/cover-claude-code-skill.svg',
    title: 'How to write a Claude Code skill that people will actually use',
    type: 'tutorial',
    date: 'October 14, 2025',
    readingTime: '10 min',
    color: 'paper-yellow',
    tags: ['claude code', 'skills', 'tutorial'],
    excerpt:
      'A skill is a recipe Claude reaches for when the situation matches. The hard part is the situation, not the recipe.',
    seoDescription:
      'Step-by-step guide to writing a Claude Code skill — SKILL.md format, trigger description, real /ship-pr example, testing, and the mistakes to avoid.',
    keywords: 'Claude Code skill, SKILL.md, slash command, .claude/skills, agent workflow, Anthropic',
    intro:
      `Skills are the most under-used feature in Claude Code. People write one or two, find them useful, and then never write another one. Which is a shame, because skills are the place where "the agent works the way I want" turns into "the agent works the way I want, every time, without me typing the prompt again."\n\nThis is the short tutorial: anatomy of a skill, the part that actually matters, and a worked example you can adapt.`,
    sections: [
      {
        heading: 'A skill is a recipe, not a function',
        body: `A skill is a markdown file. Front matter on top, instructions below. Claude reads the front matter to decide whether the skill is relevant to what is happening, and reads the body when it picks the skill up.\n\nThat is it. There is no DSL, no YAML schema you have to learn, no programming. The whole format is "tell Claude when this applies and what to do."\n\nWhich is also why most skills are bad. The format is so loose that you can write a skill that does nothing. The format is also why a small amount of craft goes a long way.`,
      },
      {
        heading: 'The three things that matter',
        body:
`![A skill is three things — a name, a description (when to use it), and steps the model can run.](/blog/diagram-skill-anatomy.svg)\n\nIn order of importance:\n\n1. **Description.** When to use this skill, in plain English. The model uses this to decide if the skill matches the current situation. This is the one that decides whether your skill ever gets used.\n2. **Name.** Short, imperative, matches the slash command. \`ship-pr\`, not \`pr-shipping-helper\`.\n3. **Body.** The steps the model should run when the skill applies.\n\nIf any of these is wrong, the skill fails for a predictable reason. A weak description means the skill is never picked. A weak body means the skill is picked and bumbled.`,
      },
      {
        heading: 'The trigger description does most of the work',
        body: `If you only edit one part of your skill, edit the description.\n\nA bad description:\n\n> "Helps with PRs."\n\nA better description:\n\n> "Use when the user asks to ship, raise, open, or push a PR. Generates a title and body from the diff and runs \`gh pr create\`. Do not use for amending an existing PR."\n\nThe better one tells the model:\n\n- the trigger phrases (ship/raise/open/push)\n- what the skill does (generates title + body, runs \`gh pr create\`)\n- when **not** to use it (amending an existing PR)\n\nThe "when not to use" line is the underrated part. It prevents the skill from being misapplied to adjacent tasks.`,
      },
      {
        heading: 'Steps the model can run, not concepts to admire',
        body: `Skill bodies fail in predictable ways:\n\n- **Too abstract.** "Make sure the PR is high quality." OK. How? The model will improvise, badly.\n- **Too prescriptive.** "Run \`git status\` exactly. If the output starts with the string 'On branch', proceed." Brittle. Things change.\n- **Just right.** Numbered steps that are concrete enough to follow and loose enough to survive a small change in environment.\n\nThe sweet spot reads like instructions for a smart, fast colleague who has not seen this project before. They know how to use git. They do not know your conventions. The body fills the gap.`,
      },
      {
        heading: 'A worked example: /ship-pr',
        body:
`The full skill, end to end:\n\n\`\`\`md
---
name: ship-pr
description: |
  Use when the user asks to ship, raise, open, or push a PR for
  the current branch. Generates a title and body from the diff and
  opens the PR via \`gh pr create\`. Do not use for amending an
  existing PR.
---

# Steps

1. Run these in parallel, each via the Bash tool:
   - \`git status\` (no -uall)
   - \`git diff\` and \`git diff main...HEAD\`
   - \`git log main..HEAD\` to see the commits on this branch
   - \`git rev-parse --abbrev-ref @{u}\` to check the upstream

2. If the branch is not pushed yet, push with \`-u\`. Otherwise just open the PR.

3. Draft a PR title:
   - imperative mood ("Add … " not "Added …")
   - <70 characters
   - no trailing punctuation

4. Draft a PR body with two sections:
   - **Summary** — 2-3 bullets, focused on the *why* not the *what*
   - **Test plan** — checklist of TODOs for verifying the change

5. Open the PR with \`gh pr create --title "…" --body "…"\`. Use a HEREDOC for the body to preserve formatting.

6. Print the PR URL.

# What not to do

- Do not commit or amend before opening the PR.
- Do not push to \`main\` or \`master\`.
- Do not use \`--force\` on push.
\`\`\`\n\nThis is short. It runs reliably. It survives most edge cases. The "What not to do" section is doing real work — it is the line between "skill that ships PRs" and "skill that occasionally force-pushes to main."`,
      },
      {
        heading: 'How I test a skill before shipping it',
        body: `Three rounds of testing, in order:\n\n1. **The right situation.** Ask Claude in a way that should trigger the skill. Did it pick the skill up? If not, the description is wrong.\n2. **The wrong situation.** Ask Claude in a way that should NOT trigger the skill. Did it stay away? If not, the description is too greedy.\n3. **The edge cases.** Run the skill in the situation it works for, but with one thing weird (no upstream branch, dirty working tree, etc.). Did it handle the weird thing or did it bumble?\n\nIf the skill survives all three, ship it. If it fails round 1 or 2, edit the description. If it fails round 3, edit the body.`,
      },
      {
        heading: 'When NOT to write a skill',
        body: `- the workflow is one tool call away from done\n- the workflow is different every time\n- you cannot describe when the skill applies in one paragraph\n- you would not run the workflow yourself the same way twice in a row\n\nA skill is an investment. You only get a return if the workflow is repetitive enough to be worth encoding. Write skills for the things you do every week, not for the things you might do someday.`,
      },
      {
        heading: 'A short checklist before you ship a skill',
        body: `- name is a verb\n- description starts with "Use when …"\n- description includes "Do not use when …"\n- body is numbered steps a careful colleague can follow\n- body has a "What not to do" section if the skill could go sideways\n- you have actually run the skill on three real situations\n- the skill is in the right place: project for team-shared, global for personal\n\nIf all seven pass, you have a skill that will get reached for. That is the whole goal.`,
      },
    ],
  },

  {
    slug: 'mcp-explained-for-people-with-real-work-to-do',
    cover: '/blog/cover-mcp-explained.svg',
    title: 'MCP, explained for people with real work to do',
    type: 'guide',
    date: 'September 28, 2025',
    readingTime: '11 min',
    color: 'paper-coral',
    tags: ['mcp', 'protocol', 'agents'],
    excerpt:
      'A short, plain-English explanation of MCP — what it is, what it is not, and when it is the right tool versus when you are reaching for it because it is fashionable.',
    seoDescription:
      'A clear, opinionated overview of the Model Context Protocol — the architecture, the three primitives (tools, resources, prompts), transport options, and when to actually build a server.',
    keywords: 'Model Context Protocol, MCP, Anthropic, agent, tools, resources, prompts, JSON-RPC, stdio',
    intro:
      `MCP is one of those acronyms that has accumulated more enthusiasm than explanation. Since I have spent enough time both reading the spec and shipping servers, I will try to give you the version I wish I had on day one.\n\nMCP is the Model Context Protocol. It is a small JSON-RPC protocol for letting LLM clients talk to servers that expose tools, data, and prompt templates. The protocol is dull on purpose. Almost all of the interesting work is in what you choose to expose.`,
    sections: [
      {
        heading: 'What MCP actually is (not the marketing version)',
        body: `An MCP server is a process you run. It exposes some combination of:\n\n- **tools** — functions a model can call (with a name, input schema, and description)\n- **resources** — read-only blobs the model can fetch (files, URLs, database query results)\n- **prompts** — saved prompt templates the user (or client) can pick up\n\nAn MCP client is a program that knows how to talk to MCP servers. Claude Desktop is one. Claude Code is one. There are others, growing.\n\nThe protocol between them is JSON-RPC over one of three transports: stdio, SSE, or HTTP. Pick the simplest one that works.\n\nThat is it. Everything else is decoration.`,
      },
      {
        heading: 'Three things a server can expose',
        body:
`![Tools, resources, prompts. Each does a different job.](/blog/diagram-mcp-architecture.svg)\n\n- **Tools** are for **doing**. The model decides to call them. They have side effects sometimes. \`create_ticket\`, \`run_query\`, \`send_email\`.\n- **Resources** are for **reading**. The client (or user) decides to load them. They are read-only. A specific file, a specific row, a specific document.\n- **Prompts** are for **prescribing**. They are saved templates that show users how to use the server. Often forgotten; often the most useful.\n\nMost servers I have seen ship only tools. They could ship more. The combination of "tools + a prompt template that shows the right way to use them" is dramatically better than tools alone.`,
      },
      {
        heading: 'The protocol is dull on purpose',
        body: `MCP is JSON-RPC. Standard request/response, with a small set of methods: \`initialize\`, \`tools/list\`, \`tools/call\`, \`resources/list\`, \`resources/read\`, \`prompts/list\`, \`prompts/get\`. There is a standard initialization handshake. There are notifications.\n\nNobody chose JSON-RPC because it was exciting. They chose it because it is boring, and a boring foundation is the right foundation for an ecosystem that needs to interoperate. If you find yourself frustrated that the protocol is "too simple," you are looking at the wrong layer for excitement.`,
      },
      {
        heading: 'When to build your own',
        body: `Build an MCP server when:\n\n- you have a system the model would benefit from talking to (database, API, file store, internal tool)\n- you want the same integration to work in multiple clients (Claude Desktop, Claude Code, future clients)\n- you want a single place to enforce auth and rate limits between models and that system\n- "the agent should be able to do X" comes up more than twice\n\nDo not build one when:\n\n- a single tool call from a single client is enough; just write the tool and skip the server\n- the upstream system is unstable enough that a thin proxy will hide more than it solves\n- you are building it because it is fashionable; the time is not free`,
      },
      {
        heading: 'Choosing a transport',
        body: `Three options, three honest pictures:\n\n- **stdio.** The default for local servers. The client launches your server as a subprocess and talks to it over stdin/stdout. Easy to debug. Fast. Cannot be shared between machines.\n- **SSE.** The default for "I want a server my whole team can use." Server runs once, multiple clients connect over HTTP+SSE. Slight overhead vs stdio, fine for almost everything.\n- **HTTP.** Newer transport. Same shape as SSE for many cases; check current spec docs for nuance. Useful when SSE is overkill or your hosting environment hates long-lived connections.\n\nMy default: stdio for personal/dev, SSE for team-shared, HTTP if your hosting forces it. The protocol is the same; only the wire layer changes.`,
      },
      {
        heading: 'Security tripwires',
        body: `MCP servers are remote code execution surfaces if you let them be. A few rules I keep:\n\n- **Auth is your problem, not the protocol's.** MCP does not enforce auth. If your server is networked, it needs a token, and the token belongs in env, not in the URL.\n- **Treat tool inputs as adversarial.** The model does not type-check the way humans do. Validate inputs even when the schema "should" handle it. Especially for shell-out, SQL, or file paths.\n- **Tool capabilities should be the minimum needed.** Read-only first; promote to write only when needed; never expose admin or destructive tools without a separate, narrower auth boundary.\n- **Log everything.** Per-call logs (request id, tool name, latency, status). When something goes wrong, you do not want to be asking the model what it did.`,
      },
      {
        heading: 'A 60-line MCP server',
        body:
`Pseudocode-y but accurate. A read-only Postgres MCP server in roughly this shape:\n\n\`\`\`python
from mcp.server import Server
from mcp.server.stdio import stdio_server
import psycopg2, os, json

server = Server("readonly-pg")
conn = psycopg2.connect(os.environ["DB_URL"])

@server.list_tools()
async def list_tools():
    return [{
        "name": "run_select",
        "description": "Run a read-only SELECT and return up to 100 rows. Use only for SELECT statements.",
        "inputSchema": {
            "type": "object",
            "required": ["sql"],
            "properties": {
                "sql": { "type": "string", "description": "must start with SELECT" }
            }
        }
    }]

@server.call_tool()
async def call_tool(name, args):
    if name != "run_select":
        return {"content": [{"type": "text", "text": "unknown tool"}], "isError": True}
    sql = args["sql"].strip()
    if not sql.lower().startswith("select"):
        return {"content": [{"type": "text", "text": "only SELECT is allowed"}], "isError": True}
    cur = conn.cursor()
    cur.execute(sql)
    rows = cur.fetchmany(100)
    cols = [d[0] for d in cur.description]
    out = [dict(zip(cols, r)) for r in rows]
    return {"content": [{"type": "text", "text": json.dumps(out, default=str)}]}

if __name__ == "__main__":
    import asyncio
    asyncio.run(stdio_server(server))
\`\`\`\n\nAdd auth, query timeouts, and per-tool RBAC, and this is the spine of a real server. Most of the work after this point is in the tool surface, not the protocol.`,
      },
      {
        heading: 'The closing rule of thumb',
        body: `MCP is plumbing. Boring plumbing that lets your model talk to the world.\n\nThe interesting part is what you let the model talk to, in what shape, with what guardrails. Once you internalise that, you stop arguing about the protocol and start arguing about your tools — which is the right argument to be having.`,
      },
    ],
  },

  {
    slug: 'prompt-engineering-beyond-hello-world',
    cover: '/blog/cover-prompt-engineering.svg',
    title: 'Prompt engineering beyond hello world: patterns that actually move evals',
    type: 'deep dive',
    date: 'September 9, 2025',
    readingTime: '11 min',
    color: 'paper-blue',
    tags: ['prompt engineering', 'patterns', 'evals'],
    excerpt:
      'Six patterns that consistently moved the needle on real evals — and three that sounded clever and did nothing.',
    seoDescription:
      'Prompt engineering patterns that work in practice: structure, system vs user roles, few-shot examples, chain-of-thought, format hardening, and the things that turned out to be cargo-cult.',
    keywords: 'prompt engineering, Claude prompting, system prompt, few-shot, chain-of-thought, format hardening, eval results',
    intro:
      `Prompt engineering has accumulated a lot of folklore. Some of it is right. Some of it was right for a 2023 model and is just noise now. Some of it sounded right and never was.\n\nThe only honest filter is evals. So this post is the patterns I have actually seen move evals on Claude Sonnet/Opus class models — and a few I have stopped using because they did not.`,
    sections: [
      {
        heading: 'The patterns that survive evals',
        body: `In rough order of impact, on the kind of work I do (agentic, tool-using, structured output):\n\n- **Structure the system prompt.** Headings, sections, role at top.\n- **Move enforced rules to the top of the system prompt.**\n- **Show one good example, not five mediocre ones.**\n- **Ask for the format you want, in the format you want it.**\n- **Tell the model when to stop.**\n- **Name the failure modes you have seen.**\n\nNone of these are surprising. They are also the patterns that consistently produce 5-15 point lifts on the eval slices I track. The rest of this post is about what each one looks like in practice.`,
      },
      {
        heading: 'System vs user vs assistant',
        body: `Three roles, three different jobs:\n\n- **System.** Durable instructions that should hold across all turns. Identity, constraints, output format expectations, tool guidance.\n- **User.** What the user actually asked, plus state that changes per turn (current file, current selection, current question).\n- **Assistant.** Past model turns. You usually do not handcraft these.\n\nA recurring mistake: stuffing per-turn state into the system prompt. The model treats system prompt content as "always true." If you put "the current file is foo.py" in the system, the model will quietly assume foo.py is always the current file. Put per-turn state in the user message.`,
      },
      {
        heading: 'Structure the system prompt',
        body: `Models attend to structure. A flat wall of paragraphs is harder to reference than a structured doc. Use headings.\n\nThe shape that has held up:\n\n\`\`\`md
# Role
You are a code review assistant for the auth subsystem.

# Hard rules
- never propose code changes that touch \`legacy_session_id\`
- always check tenant_id is present in queries
- if the diff includes a migration, refuse and tell the user to use \`/migrate-db\`

# Style
- terse; one paragraph per finding
- include file:line references
- no preamble
\`\`\`\n\nThe rules section is the part the model treats as enforced. Put the load-bearing constraints there. Style preferences go below them — important, but if a rule conflicts, the rule wins.`,
      },
      {
        heading: 'Few-shot is mostly grammar',
        body: `Examples in your prompt are doing two things at once. They show the model what good answers look like, and they teach the model the **shape** of the answer.\n\nThe shape often matters more than the content. One well-formed example with the right tags, indentation, and tone teaches the model the format. Five mediocre examples teach the model nothing except "the format is variable."\n\nMy rule: one or two examples, picked deliberately. Both correct. If they cannot be both correct, you are not yet sure what good looks like.`,
      },
      {
        heading: 'Chain-of-thought in 2026',
        body: `On older models, "think step by step" was magic. On Claude Sonnet 4-class models, it is mostly noise unless you are doing the kind of math/logic puzzle the original CoT papers were about.\n\nWhat works better in production:\n\n- **Scratchpad with a structure.** "Before you answer, list the constraints, then the candidate plan, then objections, then the chosen plan."\n- **Ask for a plan first, then the answer.** Two-pass: ask for the approach, look at it, then ask for the implementation. Cheaper than re-running, more reliable than one-shot.\n- **Tool-augmented reasoning.** If the model can check itself with a tool ("does this file actually exist," "does this function take that arg"), let it.\n\nGeneric "think step by step" sometimes still helps; it almost never hurts; it is far from the biggest lever you have.`,
      },
      {
        heading: 'Format hardening',
        body: `If you want JSON, ask for JSON. Specifically.\n\nWeak:\n\n> "Reply with structured output."\n\nBetter:\n\n> "Reply with JSON only. Use this schema: \`{ \\"verdict\\": \\"pass|fail\\", \\"reason\\": string }\`. No prose before or after the JSON."\n\nEven better, when the model supports it: tool use. A tool with a JSON schema is a structured-output guarantee that does not depend on the model "remembering" to format.\n\nA few hardening tricks I use:\n\n- "Reply with valid JSON. Do not include markdown fences."\n- "If you are unsure, set verdict to \`fail\` and explain in \`reason\`."\n- "Output ONLY the JSON. No commentary."\n\nIf you keep getting prose-wrapped JSON, the issue is almost always the prompt, not the model.`,
      },
      {
        heading: 'Tell the model when to stop',
        body: `Models, left to themselves, like to keep going. They explain. They restate. They wrap up. Small stop instructions go a long way:\n\n- "Stop after the third bullet."\n- "Do not summarise at the end."\n- "If you have nothing to add beyond what was asked, end your reply."\n\nThese sound like manners advice. They consistently move the eval slice on output length and verbosity-related rubrics.`,
      },
      {
        heading: 'Name the failure modes you have seen',
        body: `If your model has a quirky failure — say, it likes to add a "Disclaimer:" section nobody asked for — name it in the prompt:\n\n> "Do not add disclaimers. Trust the user to know they are reading model output."\n\nIt feels weird, like you are talking to the model about its own habits. It works. The mention pushes the failure mode to the foreground of attention, which is the only place it can be suppressed.`,
      },
      {
        heading: 'Things I stopped doing',
        body: `- "You are an expert in X." Marginal at best on capable models. Add the rules instead.\n- Long persona descriptions ("you are a helpful, kind assistant who…"). Tokens for nothing.\n- "Take a deep breath." Genuinely magic for older models. On 2026 models, noise.\n- Exclaiming the importance of the task ("This is very important!"). The model is unmoved.\n- Ten variations of "be precise" instead of one specific instruction.\n\nNone of these are harmful; all of them are wasted tokens. Spend the budget on structure and rules.`,
      },
      {
        heading: 'The order I tune in',
        body: `When a prompt is not performing, I look at things in this order:\n\n1. Are the hard rules at the top of the system prompt?\n2. Is per-turn state in the user message, not the system?\n3. Is the output format described in the same shape as the desired output?\n4. Are there one or two examples, both correct?\n5. Does the prompt name the failure modes I have seen?\n6. Only then: model, temperature, anything fancier.\n\nNine times out of ten, the fix is in the first three.`,
      },
    ],
  },

  {
    slug: 'token-optimization-in-claude-12-hacks',
    cover: '/blog/cover-token-optimization.svg',
    title: 'Token optimization in Claude: 12 hacks I use every day',
    type: 'guide',
    date: 'August 18, 2025',
    readingTime: '12 min',
    color: 'paper-yellow',
    tags: ['tokens', 'optimization', 'claude'],
    excerpt:
      'Tokens are the only resource that quietly compounds. Twelve practical hacks that move the meter on real workloads.',
    seoDescription:
      'Twelve practical token optimization techniques for Claude — caching, schemas over prose, trimming tool results, model routing, early stopping, and the small habits that cut bills meaningfully.',
    keywords: 'Claude token optimization, prompt caching, tool results, model routing, token budget, Anthropic API costs',
    intro:
      `Tokens are the only resource that quietly compounds. Pricing pages talk about per-million costs, but the real cost shows up later: latency, context bleed, evals that drift.\n\nAfter eight months of running Claude in a production threat-intel pipeline, I have a small, boring list of things that consistently move the meter. They are small individually. Stacked, they cut the bill on one of our agent loops by about 60% and dropped p95 latency by a third — without changing the model or what the agent does.`,
    sections: [
      {
        heading: 'The mental model',
        body:
`Where the tokens actually go on a typical agent turn:\n\n![Where the tokens go: tool defs and system prompt at the top, files and docs in the middle, tool results doing the bloating, user and model output at the bottom.](/blog/diagram-token-flow.svg)\n\nThe interesting thing is that **user input and model output** — the things people instinctively try to optimise — are the smallest slice. The biggest slice is **tool results** and the second biggest is **static context that never changes**.\n\nWhich means: optimise the static stuff first (with caching) and the tool results second (by trimming). Optimising user/model length is the smallest lever.`,
      },
      {
        heading: '1. Cache like you are paying rent (you are)',
        body: `Anthropic prompt caching is the cheapest performance win in the API. ~90% off the cached tokens, dramatic latency drop.\n\nMinimum viable caching: put a \`cache_control: {"type": "ephemeral"}\` on the last block of your system prompt and on the last tool definition. That alone covers most of the gain on most workloads.\n\nMore detail in [Caching like you mean it](/writing/caching-like-you-mean-it-anthropic-prompt-caching). If you skip everything else here, do this.`,
      },
      {
        heading: '2. System prompts: short, specific, top',
        body: `A short system prompt is not just cheaper — it is more obeyed. Constraints near the top of a 200-token system prompt are foreground attention. Constraints in the middle of a 5,000-token system prompt are not.\n\nMy default shape: a 100-300 token system prompt, with hard rules above style preferences. Per-turn state belongs in the user message, not the system prompt. Anything that changes per call is poisoning your cache and diluting your attention.`,
      },
      {
        heading: '3. Don’t paste, point',
        body: `Pasting a 14,000-token file into the prompt for a question about three lines is 14,000 tokens of waste.\n\nGive the agent a tool to read paths. Let it pull what it needs. Most of the time it asks for one or two files; sometimes none, because the answer is in the conversation already.\n\nThis single change has saved more tokens on more workloads than anything else I have done.`,
      },
      {
        heading: '4. Schemas over prose',
        body: `A 600-word natural-language description of "what an Indicator looks like" is more expensive and less reliable than a 60-line JSON schema.\n\nWhen I want the model to produce or validate structured data, I include the schema, not the prose. The model handles the schema better. The prompt is shorter. The output is more consistent. Three wins for one change.`,
      },
      {
        heading: '5. Trim tool results before they hit context',
        body: `The single most effective server-side fix. Tool results are the biggest single contributor to context bloat in agent loops.\n\nFour habits:\n\n- cap rows at 20 (paginate if needed)\n- truncate strings longer than ~2,000 characters with a marker ("…<truncated, 3,400 chars>")\n- drop fields the agent does not use; do not return everything because you can\n- summarise large blobs to "shape + first three rows" instead of returning the whole thing\n\nA tool that returns 8,000 tokens on a "give me the campaign" call is a tool that just wasted 8,000 tokens worth of attention.`,
      },
      {
        heading: '6. The subagent split',
        body: `If verifying the answer to a subtask would take >8k tokens of context, that subtask belongs in a subagent. The main thread sees a one-paragraph summary and stays clean. Subagent details in [Subagents and parallelism](/writing/subagents-and-parallelism-stop-cramming-context).`,
      },
      {
        heading: '7. JSON beats markdown when the model writes for code',
        body: `If the next consumer of the model's output is code, ask for JSON. Markdown is more expensive (more punctuation tokens), more variable (the model styles it), and harder to parse.\n\nMarkdown for humans. JSON for everything else.`,
      },
      {
        heading: '8. Use Haiku where Haiku belongs',
        body: `Not every step in your pipeline needs Sonnet/Opus. Cheap models are remarkably good at:\n\n- "is this text a question or a statement"\n- "extract the entity ids mentioned"\n- "summarise this 200-word note in one sentence"\n- LLM-as-judge in eval pipelines\n\nRouting these steps to Haiku saves real money and barely moves quality. The Sonnet/Opus budget gets concentrated on the steps that need it.`,
      },
      {
        heading: '9. Let it stop early',
        body: `\`max_tokens\` is the budget, not the goal. Most replies are far shorter than the cap.\n\nWhen the format is structured, you can give the model an explicit stop signal: "Reply with one JSON object and stop." For longer replies, "Stop after the third bullet" is shockingly effective.\n\nThe alternative — the model wandering for another 400 tokens because it can — is a small, daily tax that adds up.`,
      },
      {
        heading: '10. Cache the tool definitions, never reorder them',
        body: `Tool definitions are static between turns and large in aggregate. Cache them. But: cache invalidates on byte change, and several SDKs sort tools differently between calls.\n\nSort once, deterministically. Commit the order. Cache the block. Verify with \`cache_read_input_tokens\` in the response — if it is zero on a workload that should be hitting, your tool order is drifting.`,
      },
      {
        heading: '11. Measure with a token budget, not a ceiling',
        body: `A 200k context window is permission, not target. Set a soft budget per turn ("I want this loop to run under 25k tokens of input on average") and treat overruns as bugs. The budget makes the team's optimisations legible and forces a conversation when something balloons.\n\nBudgets work because they are stable. "Token usage feels high" is a vibe. "We are 38% over budget on the auth-review loop" is a ticket.`,
      },
      {
        heading: '12. Log usage, alert on it',
        body: `Every Anthropic API call returns a \`usage\` block. Log it. Aggregate it. Alert on regressions.\n\nThe alerts that have caught the most for me:\n\n- average input tokens per call up >25% week over week — usually a prompt change, occasionally a runaway tool result\n- \`cache_read_input_tokens\` collapses to zero — usually someone added a timestamp to the system prompt\n- model output up >50% — usually a prompt instruction got softer ("be thorough" creep)\n\nNone of these are exotic. All of them have caught a real regression at least once.`,
      },
      {
        heading: 'The boring closer',
        body: `None of these are clever. They are the boring layer of professional craft that turns "the model is expensive" into "the model is fine, actually."\n\nIf you only do three: **cache the static stuff, trim tool results, point to files instead of pasting them.** That is most of the gain on most workloads. The other nine are just refinements.`,
      },
    ],
  },

  {
    slug: 'favoritism-the-art-of-causing-harm-in-harmless-ways',
    cover: '/blog/cover-favoritism.jpg',
    title: 'Favoritism – the art of causing harm in harmless ways',
    type: 'observation',
    date: 'March 30, 2022',
    excerpt:
      'favouritism /ˈfeɪv(ə)rɪtɪz(ə)m/ the practice of giving unfair preferential treatment to one person or group at the expense of another.',
    intro:
      'There is little to no harm in having a favourite genre of music, TV series, favourite movie, and sports, amongst others. However, practicing it at other places like an institute, place of work or an organization can be catastrophic and can cause harm in harmless ways.\n\nThough, the bias may seem obvious at some places, the person practicing it can be conscious or unconscious about it being practiced and needs awareness and training to combat. In case of a conscious bias, the person is aware of the activity and have a calculate impact of the decisions that he/she is making. On the other hand, if the person is not aware that the decisions being made are in favour of some people and excluding the others, it can become very difficult to confront or call into question of the things being practiced.',
    sections: [
      {
        heading: 'What can you do about it (as a victim)?',
        body: 'Many people often ignore or pretend that they didn\'t knew about the practices in fear of retaliation, but it is essential for a person to take necessary actions to safeguard what is in the best interest of the organization. There are few ways which people can follow to mitigate/reduce favouritism at work.\n\nAssess the situation logically from both ends. Understand all the possible scenarios and empathize why the decision would have happened. Was it an influenced decision or was it something calculated.\n\nTalk about it with someone who can look at the situation unbiased and can provide some constructive feedback and directions that you may need to to deal with the situation.\n\nIn case you have followed the above, then you have assessed the situation from your part and can stand-up to speak up for yourself.',
      },
      {
        heading: 'What can you do about it (as a leader)?',
        body: 'Not just employees, it becomes very difficult for leaders to ensure these practices as any wrong decision can do unseen damage.\n\nAssess the situation logically from both ends. Understand all the possible scenarios and empathize why the decision would have happened. Was it an influenced decision or was it something calculated.\n\nMake sure everyone\'s playing by the same rules.\n\nEncourage occasional skip-level meetings so that your employees have the opportunity to meet with the boss\'s boss. You are more likely to hear about favoritism occurring when communicating as the manager\'s boss.',
      },
      {
        heading: 'The impact',
        body: 'Favouritism at work can jeopardize the trust employees have in their leaders or their teammates, breed resentment, create conflicts, and undermine collaboration. In fact, a study by the O.C. Tanner Institute found that favouritism can stifle engagement and increase the odds of employee burnout by 23%.\n\nFavouritism is by default a human nature. One cannot be completely unbiased but there are ways to reduce and eliminate these by proper trainings and practicing them often. Fortunately, if leaders and employees know the signs of favouritism, then you can hold each other mutually accountable for stopping favouritism in its tracks.',
      },
    ],
  },
  {
    slug: 'own-it-forever-or-leave-it-forever-but-try',
    cover: '/blog/cover-try.jpg',
    title: 'Own it forever or Leave it forever – But TRY',
    type: 'essay',
    date: 'July 10, 2020',
    excerpt:
      'Ever came across things that lure you into the thoughts of trying it out, but the risk is way too big?',
    intro:
      'Ever came across things that lure you into the thoughts of trying it out, but the risk is way too big? We came across many things around our daily chores we feel like it is worth trying but anyway we ignore the bigger picture and unconsciously continue doing what we are doing. But deep inside there is that subconscious of inner mind that provides periodic intimation of trying that out.\n\nMore often, you will find people saying that this is not for you. Some will even shatter your hopes by giving examples of other people. They are not good. They are not bad either. The truth is they do not even know what you are up to. Yet they would advise you to keep away from that very thing.\n\nI am not asking to ignore those people, disrespect them nor I am telling you that you believe them blindly. I am asking you to open your eyes and see through your vision. Adding to that, also look who is speaking about what. A job professional should not advice on pursuing business just because the job offers security. A person in Technology should not portray views on Manufacturing Industry, and vice versa just because of the incomplete knowledge.',
    sections: [
      {
        heading: 'My point',
        body: 'No matter what the case, the society will have people to make you believe that you are not doing things right. What is funny to this is there is one more case where the man carries the donkey, and yet the society blames him for not utilising that.\n\nKeeping things precise, I would say that there is no harm in exploring things that you have always dream. Even if the dream is small enough, you should give a thought to pursue that path of unknown. You never know what is there in the path unless you travel it.\n\nMany of us simply ignore that inner call. I\'d suggest going with that instinct and pursue that. Life should not be limited, rather an amazing experience of the unlimited. Even if it means burning down our comforts and making us uncomfortable.',
      },
      {
        heading: 'Comfort is the enemy',
        body: 'Gibran said it rightly:\n\n"Comfort! Comfort the treacherous, the deadly! Comfort that cheats our senses and makes us slaves to the passing hour! I would not have comfort. I would have passion! I would burn in the cool space with my beloved." – The Madman (Lazarus and his beloved)\n\nDo not have comfort. There will be lot of time for it after you get old, in case you get old! Life is not meant to be monotonous. It has so much to offer, so much to give and here are you; all packed in so called Nine to Five. The point is to break the circle, get out of that trap, and explore the unlimited. Offcourse, you can fall back in anytime you feel that exploration is not for you.',
      },
      {
        heading: 'But try',
        body: 'But Try! Trying it will ensure that you do not have second thoughts. You will not have regrets; it is the only problem in this modern-day lifestyle. People live borrowed lifestyle. Most of them are afraid to follow their inner instincts and slowly loses the essence of life.\n\nThere is nothing bad in going back to the old lifestyle just in case that did not worked out in the first place. At least, you would know that you gave it a try and those thoughts would no more play with your inner conscious.',
      },
    ],
  },
  {
    slug: 'you-are-important-so-are-your-needs',
    cover: '/blog/cover-needs.jpg',
    title: 'You are important, so are your needs!',
    type: 'personal',
    date: 'October 1, 2019',
    excerpt:
      'No one was put on the planet to meet your needs! You weren\'t put on the planet to meet your father\'s, your mother\'s, your friend\'s, girlfriend\'s, or someone else\'s need.',
    intro:
      'No one was put on the planet to meet your needs!\n\nYou weren\'t put on the planet to meet your father\'s, your mother\'s, your friend\'s, your girlfriend\'s, someone else\'s need.\n\nSource: Dr. Robert Globber (NOMOREMRNICEGUY)\n\nRead the above text again and again till the time you realize it.\n\nYou are a human. You have needs. It is okay to have needs.',
    sections: [
      {
        heading: 'The importance of giving yourself the power to control your own life',
        body: 'During these last few years in which I have come across many people (including myself) who fail to prioritize their needs. People like me, who are ready to help others at any given time but often neglect their own needs be it a matter of love, life, job, family, money, and friends amongst others. Did I forget to mention yourself again?\n\nYes, that\'s what I\'m going to share in this blog. The importance of giving yourself the power to control your own life. Do you know what you are capable of doing if you follow your instincts and desired path? Well, that falls in the no-knowing zone since it has not happened yet!\n\nYou have a choice to make. A choice that would not please your family, friends and acquaintances, but yourself. I\'m not sure of the end result, but in the process you\'ll get enormous amount of energies from various sources some of which are listed below:\n\nExercise. Workout. Go out for a walk. Eat healthy food. Get Enough sleep. Relax, play, goof off! Get a massage. Go out with buddies. If you don\'t have buddies, make some! Buy a new pair of shoes. Get dental work done. Listen to some good music. Join a club, sport, course. Learn an instrument. Go on a solo trip! Get a complete body treatment! Quit that toxic job. End that toxic relationship. Start doing that you were planning from so long! Update your skills.',
      },
      {
        heading: 'Start small, be consistent',
        body: 'How many things do you practice on a regular basis? How many things are missing? Is there something else of your choice that you\'d like to add? Create your own bucket list of things that you have been avoiding from a long time. Talk to safe people, share your plans and ask them to keep a check on you. Not everything is an overnight hustle. Take baby steps to implement it. Start small, be consistent and you\'ll see the magic of compounding.\n\nEver wondered what\'s common in entrepreneurs like Elon Musk, Bill Gates, Zuckerberg, Jeff Bezos, Gary Vaynerchuck, and Richard Branson, amongst others? They never quit. What fuels their energy? Kindness, compassion and generosity fuels them. See the person who inspires you most and then research on his/her lifestyle. You\'ll find that healthy lifestyle is priority every time. When the body and mind is in amazing sync, you\'re able to unlock your power to do things that seem extraordinary.',
      },
      {
        heading: 'Start today',
        body: 'The compounding of various activities will soon become auspicious. Start today; right here, right now! Do not postpone things for tomorrow, for there will be no tomorrow. Do not work for appreciation or just to prove to anyone but yourself that you\'re capable. Do it and see how much pleasure and amazing energy the process will give you. The potential will soon unfold and you\'ll be able to experience the true calling.\n\nYou have to take an initiative for yourself, an initiative that improves you holistically. Keep in mind the list of things that you imagined for yourself. Remember your dream of achieving greatness and reaching the zenith? Guess what? The dreams are already there in the clouds. You just have to put foundations under them.',
      },
    ],
  },
  {
    slug: 'its-okay-to-fail-once-twice-thrice-or-even-1000-times',
    cover: '/blog/cover-fail.jpg',
    title: 'Its okay to fail – once, twice, thrice or even 1000 times',
    type: 'essay',
    date: 'May 15, 2019',
    excerpt:
      'Hard work comes before success in the dictionary? Do you know what else comes before success? Failure.',
    intro:
      'Failure has always been essential, rather an important ingredient in the process of cooking success and happiness. Positive cannot exist without the negative, they are two sides of the same coin. Some days it is on the positive side, other days it is on the negative. What actually matters is the overall value of the coin.',
    sections: [
      {
        heading: 'The anti-failure strategy – survivors',
        body: 'It is extremely important to know that there is nothing called overnight success. Even the most successful figures have shared their stories of hardships and struggle. Everyone has his own perception of life and struggles. What may seem alluring on one side might not be the same in actual.\n\nEveryone, including but not limited to, students, teachers, coaches, players, professionals, businessmen, entrepreneurs and industrialists, amongst others have suffered from failures and came up with a way to manage things and keep trying subsequently resulting to so-called overnight success.\n\nThe best thing about survivors is that they\'re accept failures. The understand that it is a part of life and hence do not let the failures dictate the life transformation. Failures are being taken as a knowledge resource and to improve the future experience.',
      },
      {
        heading: 'My inspiration',
        body: 'Let me tell you a small story about one of my friend from my hometown. Those were the High School days and he was the stud and hugely popular among guys who do all the silly things but study. School days were gone, and soon we were busy in building our careers.\n\nTime passed, and the contact became less. However, the image was same as it was created in school days. Soon, we were in the same city and I envy him of his lifestyle. At that time, he didn\'t bother to explain things and said that the "Grass is always greener on the other side of the fence."\n\nFinally, time came and and we were living together under the same roof. I was astounded by seeing such a drastic change in his lifestyle. He developed a passion and soon enrolled in of the premier colleges in that domain. The person I knew has transformed drastically. He was no more the same person I used to know.\n\nThe person who spent more than half of the day roaming on bikes with fellow friends was studying overnight, that too for subjects people prefer to keep their distance. I was not able to digest this. I was seeing his passion and struggle both at the same time. For our old group, he was the same person who used to roam on bikes. I had a different perception by now. Because I was the one observing that.',
      },
      {
        heading: 'Solution',
        body: 'Mindset is the solution. The key is to keep trying till the time you get used to it and develop a mindset that failures won\'t affect in any way possible. You\'ll then won\'t have the fear of failures. That is a whole new level of awesomeness and transformation that one can experience.\n\nIts okay to fail. It\'s alright. The best thing you can do is to acknowledge it and see where it can take you. It is never too late to go for the call. Even you have failed a 1000 times, its never too late to start fresh. It is okay and there is no harm in accepting that. You are not living to justify your life and doings to the society but yourself. You, yourself are your strictest judge. Don\'t let the society define you that you\'re not good enough.\n\nDo not let the failures affect you in any way possible. Take the defeat in the face, get up and get back to the game with a whole new level. That is the only way to deal with failures. Life is too short to complain about irrelevant things and giving excuses.',
      },
      {
        heading: 'My inference',
        body: 'It takes no time to comment on anybody but the story can be different, rather mind boggling. There are always two sides to any story; one which is presented on a silver platter to the crowd, and the one which is actual. From then, I keep transforming my life and accepted failures in the face. Initially, they were hard to accept but sooner I got used to them and one day finally, they didn\'t matter anymore. I knew it was nothing more than a process.',
      },
    ],
  },
  {
    slug: 'minimalism-is-the-new-sexy',
    cover: '/blog/cover-minimalism.jpg',
    title: 'Minimalism is the new sexy',
    type: 'personal finding',
    date: 'April 15, 2019',
    excerpt:
      'The more things you own, the more they own you.',
    intro:
      'Black or White? I opt grey.\n\nLife in modern day is full of chaos. People are living with lots of stress. People are keen to add things to improve lifestyle. They are missing the most important part. Before adding something they\'re not clearing the mess created in the past and consequently add more and more things making it more cluttered.',
    sections: [
      {
        heading: 'My possessions were possessing me',
        body: 'I constantly try to reduce things and make life less cluttered. Not just things, but jobs, businesses and people. Things altogether open a different perception of how the life is. There was a time when things got appreciated. Over the period only experiences remained and things were subsequently suppressed.\n\nI was a collector but my own collection soon became my stress companion. All that I had accumulated had became my own baggage to carry everywhere. My possessions were possessing me. The more things I own, the more things were owning me.\n\nThe more discarded, the more I learned. Minimalism teaches you values and align priorities. There has been a drastic change in the way I live, the way I\'m trying to discard thing continuously. I\'m on constant practice to reduce the things that I possess, less clothes, less stuff, less clutter and hence, less anxiety.\n\nNot sure about others, but I found it rather amazing to become a minimalist and sticking to the basics. Helps me more on organizing and managing my life rather than managing things.\n\nChuck Palahniuk — "The more things you own, the more they own you."',
      },
      {
        heading: 'Minimalism is the new sexy',
        body: 'Minimalism is the new sexy. Indeed, it was never out of fashion. It is the best trend one can follow to make life stress free. Even when I came across this book (The Life Changing Magic Of Tidying Up) by Marie Kondo, things became more clear and I knew that minimalism is one of those things that one should practice in depth.\n\nGone are the days to keep things so that they might be of some need in future. Give them up. Don\'t get attached to the. A wise man once said,\n\n"You give but little when you give of your possessions. It is when you give of yourself that you truly give. For what are your possessions but things you keep and guard for fear you may need them tomorrow? And tomorrow, what shall tomorrow bring to the overprudent dog burying bones in the trackless sand as he follows the pilgrims to the holy city? And what is fear of need but need itself? Is not dread of thirst when your well is full, the thirst that is unquenchable?"\n\n– Khalil Gibran (The Prophet)',
      },
      {
        heading: 'The most important things in life are not things',
        body: 'It is difficult at start, but once you start discarding, you\'ll soon see that by reducing the extra baggage, you don\'t only reduce the clutter in your environment but inside your mind as well. There would be no stress, no anxiety or no desire to possess things.\n\nThe most important things in life are not things!',
      },
    ],
  },
];
