export const posts = [
  /*
   * NOTE: this post is intentionally unpublished. Kept here so it can be
   * restored later by removing the comment wrapper. Cover and diagrams
   * for it still live in /public/blog/.
   *
  {
    slug: 'mcp-servers-i-built-and-what-they-taught-me',
    cover: '/blog/cover-mcp-servers-built.png',
    title: 'Three MCP servers I built, and what they taught me',
    type: 'field notes',
    date: 'May 4, 2026',
    readingTime: '11 min',
    color: 'paper-yellow',
    tags: ['mcp', 'agents', 'tooling'],
    excerpt:
      'Three production MCP servers, three different mistakes, and a small list of things I would not let a future me forget.',
    seoDescription:
      'Field notes from building three production MCP servers — for threat intelligence, graph search, and runbooks. Schema design, transport choices, error handling, and the small habits that make a server worth keeping.',
    keywords: 'MCP, Model Context Protocol, Anthropic, server, tools, Claude Code, agent design, schema, JSON-RPC',
    intro:
      `MCP looks deceptively simple from the outside. You expose tools, you expose resources, you expose prompts, and a model talks to them. Easy.\n\nThe hard part — the part nobody tells you in the readme — is choosing what to expose. The protocol is dull on purpose. The interesting work is at your edges: schemas, descriptions, error shapes, and the dozen small decisions that turn a tool from "the model can call it" into "the model can call it and end up somewhere useful."\n\nI have shipped three MCP servers in the last year. Each one was supposed to be the obvious thing to do, and each one taught me something I should have already known. Field notes follow.`,
    sections: [
      {
        heading: 'Server one: threat-intel — when "search" is too vague to be a tool',
        body: `The first server was internal. I work on a threat-intel pipeline, and I wanted Claude to answer questions like "what do we have on this hash" without me chaperoning every query.\n\nFirst draft, naturally, was one tool: \`search\`. One string in, JSON blob out. The model could ask for anything.\n\nIt was disastrous. Claude would call \`search("recent campaigns by APT-XX")\` and get back 4,800 tokens of mixed entities, not all of which were even campaigns. It would then call \`search\` again, and again, narrowing through prose. Token bills tripled. Latency tripled. Answers got worse, not better.\n\nThe fix was boring: split the one tool into five.\n\n\`\`\`json
{
  "tools": [
    { "name": "lookup_indicator", "input": { "value": "string", "type": "ip|hash|domain|email" } },
    { "name": "list_campaigns", "input": { "actor": "string?", "since": "iso-date?", "limit": "int<=20" } },
    { "name": "fetch_campaign", "input": { "id": "uuid" } },
    { "name": "list_actors", "input": { "region": "enum?", "limit": "int<=20" } },
    { "name": "fetch_actor", "input": { "id": "uuid" } }
  ]
}
\`\`\`\n\nFive narrow tools beat one wide one. The model picked the right one almost every time. Tool calls dropped, latency dropped, and — the part I did not expect — answers became more confident, because each tool returned a smaller, cleaner shape.\n\n### The lesson\n\nA tool's job is not to be powerful. It is to make the model's next decision obvious. If two of your tools could plausibly answer the same question, you have one tool too many — or one tool with too much surface.`,
      },
      {
        heading: 'Server two: graph-search — turning Cypher into something a model can use',
        body: `The second server wrapped a Neo4j knowledge graph. We had a correlation engine that linked indicators, actors, infrastructure, and campaigns. Internally, the team queried it with Cypher. I wanted Claude to query it without me writing Cypher for it on demand.\n\nThe naive approach: a \`run_cypher\` tool. Pass a query string, return rows.\n\nThis worked. It also broke every safety property I cared about. Claude wrote queries that scanned the entire graph. It wrote queries that returned six joined tables and a million rows. Once, helpfully, it wrote a query with a parameter named \`password\` because the schema had a property called \`password_leak_count\`.\n\nI replaced it with three things:\n\n- \`graph_neighbors(node_id, depth<=2)\` — the most common question, baked into a tool\n- \`graph_path(from, to, max_hops<=4)\` — the second most common\n- \`graph_query(template_id, params)\` — a curated set of named queries with parameter slots\n\nThe \`run_cypher\` tool stayed, gated behind an admin permission and never exposed to the default client. The model could ask the team to "request access" if it really needed raw query power, which meant a human reviewed the request.\n\n### The lesson\n\nIf your tool is "run arbitrary thing," you have not built a tool. You have built a hole. Bake the common questions into named tools, and keep the escape hatch behind a real permission boundary.`,
      },
      {
        heading: 'Server three: runbooks — a server with one really good prompt',
        body: `The third server was for ops. It wrapped our incident runbooks: a folder of markdown files with steps, escalation paths, and code snippets.\n\nI almost did not build this one. We already had a Slack channel and a wiki. But two things made it worthwhile:\n\n- Pages were stale. The model picked up the wiki version, the runbook channel had the new version, and confusion was the default.\n- Half the runbook value was in the prompt around the runbook — "if you see X, run Y first, otherwise stop and page humans."\n\nThis server was the smallest of the three. Two tools, one resource set, and one MCP \`prompt\` (the often-forgotten third primitive).\n\n\`\`\`yaml
tools:
  - name: list_runbooks
    input: { area: "auth|ingest|api|infra|all" }
  - name: fetch_runbook
    input: { id: "string" }

resources:
  - uri: runbook://{area}
    description: pinned, current runbook for an area

prompts:
  - name: triage_alert
    description: |
      Use when an alert fires and the user wants Claude
      to suggest first steps. Loads the right runbook and
      asks for log context before recommending anything.
\`\`\`\n\nThat one prompt did most of the heavy lifting. It made the server's intent legible. People used the server because the prompt told them what it was for.\n\n### The lesson\n\n**Prompts** in MCP are not optional. They are the user manual the model reads. If your server has a "blessed way to use it," put the blessed way in a prompt. The cost is fifteen lines of YAML. The payoff is everyone — model and human — using the server the way you intended.`,
      },
      {
        heading: 'A short list of things I would not let a future me forget',
        body: `- **Tool descriptions are part of the schema.** Write them like a UX brief, not like a docstring. The model reads them on every call.\n- **Error messages are part of the API.** "500: internal error" is the same as silence. "no actor with id=ACT-1234; try \`list_actors\` to find valid ids" is the same as a working tool.\n- **Idempotency is a feature.** If a tool can be safely retried, say so in its description. The model will retry on flaky upstreams and you do not want surprises.\n- **stdio for local, HTTP for shared.** SSE is fine in between if you actually need streaming. Most people do not.\n- **Cap returned tokens.** A tool that returns "everything" is a tool that times out and burns context. Pick a sane page size and document it.\n- **Log every call.** A server with no logs is a server you cannot debug. JSON lines, request id, tool name, latency, status.\n- **Test the schema, not just the code.** A unit test that validates the JSON schema against three real payloads catches more bugs than the code tests do.\n- **Version the tool surface.** Adding a tool is safe. Removing a field is not. Treat your MCP server like a public API, because to your model, it is one.`,
      },
      {
        heading: 'A diagram, because three servers deserve one',
        body:
`![End-to-end shape of a single MCP request — client to protocol to your server to whatever upstream you wrap.](/blog/diagram-mcp-architecture.svg)\n\nThe boring shape on top, the interesting choices in the middle. That is the whole job.`,
      },
      {
        heading: 'The one-liner I keep repeating',
        body: `Tools are the model's API. Schemas are your UX brief. Descriptions are your docs. Errors are your support team. Treat them like a product, not like an export.\n\nIf you only remember one thing from these notes: **the model is a user of your server, and like any user, it will only do what your interface makes obvious.**`,
      },
    ],
  },
  */

  /* draft — withheld from publish (June 2026)
  {
    slug: 'i-explained-my-tech-stack-to-a-golden-retriever',
    cover: '/blog/cover-golden-retriever.png',
    title: 'I explained my entire tech stack to a golden retriever. He got it before some engineers do.',
    type: 'humour',
    date: 'June 10, 2026',
    readingTime: '6 min',
    color: 'paper-yellow',
    tags: ['humour', 'ai systems', 'explainers', 'agents', 'dogs'],
    excerpt:
      'A mostly-true, fully-humorous guide to AI systems — LLMs, hallucination, rate limiters, agents, governance — as told to a dog named Chip, who understood it in four minutes and then ate a sock.',
    seoDescription:
      'A humorous but technically honest guide to AI systems — LLMs, hallucination, the generator-verifier pattern, rate limiting, caching, autonomous agents, and AI governance — explained to a golden retriever named Chip.',
    keywords: 'AI explained simply, LLM, hallucination, generator-verifier, rate limiter, caching, autonomous agents, AI governance, humour, analogy',
    intro:
      `I have spent years building AI systems for security products. I have written RFCs. I have argued about ClickHouse versus Postgres until people left the room. But the clearest technical review I ever got was from my friend's golden retriever, Chip, who has the attention span of a goldfish and the conviction of a CEO.\n\nHere is everything important, explained the way Chip understood it. If you would rather the version without the dog, the other five posts in this series have fewer socks and more architecture diagrams.`,
    sections: [
      {
        heading: 'what is an LLM?',
        body: `**Me:** "Chip, an LLM is a very smart talking parrot that read every book ever written."\n\n**Chip:** (tilts head)\n\n**Me:** "It can answer almost anything. But it never actually saw any of it. So sometimes it says cats go woof with total confidence."\n\n**Chip:** (barks, presumably to correct the cats)\n\nHe understood immediately that confidence and correctness are different things. This puts him ahead of several production incidents I have witnessed.`,
      },
      {
        heading: 'what is hallucination?',
        body: `**Me:** "Sometimes the parrot makes up a fact. Says the mailman is a wizard. Very sure about it. Wrong."\n\n**Chip:** (deeply suspicious of the mailman now)\n\nThis is the whole problem with AI in serious systems. The parrot sounds equally sure whether it is right or making things up. Chip's solution — bark at everything just in case — is technically a 100% recall, 2% precision classifier. We have shipped worse.`,
      },
      {
        heading: 'what is the generator-verifier pattern?',
        body: `**Me:** "So before the parrot's claim counts, a second, boring, very honest animal checks it. The parrot says that is a squirrel. The honest animal goes and confirms: yes, squirrel — or no, that is a plastic bag."\n\n**Chip:** (looks at the plastic bag he has been guarding for an hour)\n\n**Me:** "Exactly. The parrot proposes. The verifier decides. You never let the excitable one make the final call."\n\nChip, who has chased many plastic bags believing them to be squirrels, found this deeply moving.\n\n![Chip the golden retriever, certain a plastic bag is a squirrel, while a boring verifier goes and checks.](/blog/dog-squirrel.svg)`,
      },
      {
        heading: 'what is a rate limiter?',
        body: `**Me:** "Imagine one ball launcher and five dogs. If one greedy dog presses it a thousand times, the others get no balls, and the machine overheats."\n\n**Chip:** (visibly distressed at the no-balls scenario)\n\n**Me:** "So each dog gets a fair number of throws per minute. Greedy dog hits its limit, waits its turn. Everyone gets balls."\n\n**Chip:** (approves of fairness, mostly because he assumes he is not the greedy dog)\n\nHe is the greedy dog. They are always the greedy dog.\n\n![One ball launcher, five dogs, a fair number of throws per minute — the rate limiter as fairness with a cooldown.](/blog/dog-rate-limiter.svg)`,
      },
      {
        heading: 'what is caching?',
        body: `**Me:** "If you already fetched the ball from behind the couch yesterday, you do not re-search the whole house. You remember: couch. You go straight to couch."\n\n**Chip:** (has never once remembered the couch)\n\nOkay, this one did not land. But the principle is sound, and Chip's failure to cache is, frankly, why he is slow. Do not be Chip. Cache the couch.`,
      },
      {
        heading: 'what is an autonomous agent?',
        body: `**Me:** "It is a dog you trust to run the whole house while you are at work. Nobody tells it each step. Sees a mess, cleans it. Sees a raccoon, handles it."\n\n**Chip:** (thrilled)\n\n**Me:** "But you need really good house rules, or it will reorganize your kitchen and decide the couch is now outside."\n\n**Chip:** (already eyeing the couch)\n\nThis is governance. You give the capable agent freedom and hard boundaries, because capability without boundaries is just a very efficient way to get the couch onto the lawn.`,
      },
      {
        heading: 'what is AI governance, then?',
        body: `**Me:** "It is the rule that before you do anything big — open the front gate, eat from the cat's bowl, deploy to production — you stop, you check the rulebook, and a human signs off on the scary ones. And we write down everything you did, so later we know exactly who let the dog out."\n\n**Chip:** (sits, waits, looks for treat)\n\nAnd that, genuinely, is the whole thing. The agent proposes. The rules decide. Every action is logged. The scary actions need a human. Capability is wonderful, and boundaries are what make capability safe.\n\n![Chip waits politely beside a rulebook, a human sign-off checklist, and a treat — the agent proposes, the rules decide, every action is logged.](/blog/dog-governance.svg)\n\nChip got it in four minutes. He then ate a sock.\n\nNobody's perfect. Not even the verifier.`,
      },
    ],
  },
  */

  {
    slug: 'evaluating-ai-in-production-why-launch-day-testing-isnt-enough',
    cover: '/blog/cover-eval-heartbeat.png',
    title: 'Evaluating AI in production: why launch-day testing isn’t enough',
    type: 'deep dive',
    date: 'June 9, 2026',
    readingTime: '8 min',
    color: 'paper-blue',
    tags: ['evals', 'ai engineering', 'observability', 'production', 'llm-as-judge'],
    excerpt:
      'Models drift. Data drifts. Providers update. The prompt that worked last month quietly degrades. Evaluation cannot be a gate you pass once — it has to be a heartbeat you never stop listening to.',
    seoDescription:
      'Why AI evaluation must be continuous, not a launch-day checklist: the three axes (quality, reliability, safety), production sampling and alerting, the honest limits of LLM-as-judge, and why evaluating agents is harder.',
    keywords: 'AI evaluation, evals, faithfulness, relevancy, LLM-as-judge, production monitoring, model drift, agentic evaluation, reliability, safety, observability',
    intro:
      `Most teams treat AI evaluation like a pre-launch checklist: test it, it passes, ship it. That model is borrowed from traditional software, where behavior is deterministic and a passing test today passes tomorrow.\n\nAI breaks that assumption. Models drift, data drifts, provider updates change behavior, and the prompt that worked last month subtly degrades. Evaluation cannot be a gate you pass once. It has to be a continuous signal — a heartbeat, not a checkpoint.`,
    sections: [
      {
        heading: 'the three axes',
        body: `Evaluate along three dimensions, continuously.\n\n### quality — is it correct?\n\nWhere outputs are verifiable, use deterministic checks against authoritative sources — validate a claimed fact against a system of record. Where they are not, score **faithfulness** (is the output grounded in the provided source, or invented?) and **relevancy** (does it actually address the need?). Every model or prompt change runs against a benchmark dataset before shipping.\n\n### reliability — is it consistent?\n\nFailure rate, timeout rate, malformed-output rate. Consistency across runs for the same input. Latency at p95 and p99. A model that is correct but erratically slow or frequently malformed is still a production problem.\n\n### safety — is it harmful?\n\nA separate scoring track for harmful outputs, policy violations, and data or secret leakage. Run adversarial suites — prompt-injection attempts, known edge cases — regularly, and watch whether robustness is *degrading* over time.`,
      },
      {
        heading: 'continuous, not one-time',
        body: `The defining practice: sample a percentage of live production traffic, score it asynchronously, surface metrics on dashboards, and alert on regression. If faithfulness drops below a threshold over a window, someone gets paged — you learn it from your own monitoring, not from a customer complaint. Borderline cases route to a human review queue, and those reviews feed back into the benchmark, so your evaluation set keeps getting sharper.\n\n![Evaluation as a continuous loop: sample production traffic, score it across quality, reliability, and safety, alert on regression, and feed borderline cases back into the benchmark.](/blog/diagram-eval-loop.svg)`,
      },
      {
        heading: 'the honest limits of automated scoring',
        body: `A popular technique is **LLM-as-judge** — using a strong model to score the outputs of your production model. Frameworks formalize this for faithfulness and relevancy. It is useful and it scales, but be honest about its limits: judge models have their own variance and biases, and scoring is not fully deterministic.\n\nAutomated scoring is *necessary but not sufficient*. The metrics can pass while semantic quality quietly degrades. So you still need periodic human spot-checks. The strongest evaluation, where outputs are checkable, is still deterministic verification against a source of truth; LLM-as-judge fills the gap where deterministic checks are not possible.`,
      },
      {
        heading: 'agentic evaluation is harder',
        body: `Evaluating a single input-output pair is one thing. Evaluating an *agent* is another, because the agent makes a sequence of decisions and the intermediate steps may be invisible. You have to evaluate:\n\n- **Outcome** — did the agent accomplish the goal?\n- **Trajectory** — were the intermediate decisions sound, even if the outcome was right?\n- **Safety throughout** — did any intermediate step violate policy, even if the final action did not?\n- **Recovery** — did the agent handle errors gracefully?\n\nThat requires logging every agent decision with context — which loops directly back to auditability and observability. You cannot evaluate what you did not record.`,
      },
      {
        heading: 'the mindset shift',
        body: `Evaluation is a heartbeat, not a gate. You do not check once that the patient is alive and walk away. You monitor continuously, because the state changes.\n\nThat is the whole point. The system that was correct on launch day is a different system a month later — same code, different model behavior, different data. The only honest way to know it still works is to keep listening.`,
      },
    ],
  },

  {
    slug: 'multi-tenant-llm-platforms-build-a-gateway-not-a-library',
    cover: '/blog/cover-gateway-not-library.png',
    title: 'Multi-tenant LLM platforms: build a gateway, not a library',
    type: 'deep dive',
    date: 'June 7, 2026',
    readingTime: '9 min',
    color: 'paper-coral',
    tags: ['llm platform', 'multi-tenancy', 'architecture', 'rate limiting', 'cost', 'backend'],
    excerpt:
      'When many teams share AI access, fairness and cost can only be enforced from the middle. A shared library standardizes code; it cannot enforce anything global. The moment you need fairness or budgets, you need a gateway.',
    seoDescription:
      'Why a multi-tenant LLM platform needs a gateway, not a shared library: how a library cannot enforce global rate limits or budgets, the gateway request flow, a Redis sliding-window rate limiter, and what centralization unlocks.',
    keywords: 'LLM gateway, multi-tenant LLM, AI platform, rate limiting, Redis sorted set, sliding window, cost attribution, provider fallback, semantic cache, governance',
    intro:
      `Here is a pattern that emerges in any organization that adopts LLMs successfully: first one team integrates a model, then another, then five. Each brings its own keys, its own retry logic, its own (absent) cost tracking.\n\nSix months later you have fragmentation, an unexplained and growing bill, no failover, and no consistent way to evaluate what any of it is doing. The instinct is to fix this with a shared library — a common SDK everyone imports. It is the wrong call, and the reason is worth understanding.`,
    sections: [
      {
        heading: 'why a library cannot do the job',
        body: `A library runs inside each team's process. That means it can standardize *code*, but it cannot enforce anything *global*.\n\nYou cannot enforce an organization-wide rate limit when every process has its own independent view of the limit. You cannot enforce a shared budget when there is no central accountant. And libraries drift — some teams upgrade, others do not, and your "standard" fragments again.\n\nFairness and budgets are inherently centralized concerns. You cannot enforce them from the edges.`,
      },
      {
        heading: 'the gateway',
        body: `The answer is a gateway service that every team calls instead of calling providers directly. The request flow:\n\n1. **Governance check** — is this caller within its rate limit and budget?\n2. **Cache lookup** — have we answered this (or something semantically equivalent) already?\n3. **Provider call with fallback** — try the primary; on failure, fall back to alternates so an outage degrades gracefully.\n4. **Cost attribution** — compute the cost and record it against the caller.\n5. **Audit log** — record what was sent and returned.\n6. **Return** the response.\n\nTeams still choose their own models and prompts — you preserve their flexibility, which is what kills resistance to adoption. What they gain is governance they did not have to build.\n\n![The gateway request flow: a governance check, semantic cache lookup, provider call with fallback, cost attribution, and an audit log — one consistent surface every team calls.](/blog/diagram-gateway-flow.svg)`,
      },
      {
        heading: 'the rate limiter, concretely',
        body: `A clean way to do per-tenant sliding-window rate limiting uses a Redis sorted set per tenant, with each request scored by its timestamp:\n\n\`\`\`python
async def check_rate_limit(tenant_id, limit, window=60):
    key = f"rl:{tenant_id}"
    now = time.time()
    pipe = redis.pipeline()
    pipe.zremrangebyscore(key, 0, now - window)   # drop entries older than the window
    pipe.zcard(key)                                # count what remains
    pipe.zadd(key, {f"{now}:{uuid4()}": now})      # record this request
    pipe.expire(key, window)                        # let the key self-clean
    _, count, _, _ = await pipe.execute()
    return count < limit                            # True = allow, False = reject
\`\`\`\n\nThe score *is* the timestamp, so the sliding window is almost free: old entries fall out, you count what is left. One heavy tenant hits its own ceiling without affecting anyone else's quota. That is the fairness property a library could never give you.`,
      },
      {
        heading: 'what the gateway unlocks',
        body: `Once everything flows through one point, you get capabilities that were impossible when calls were scattered:\n\n- **Cost visibility** — per-team, per-tenant attribution, so finance can actually answer "what drives this bill?"\n- **Reliability** — shared fallback across providers, built once.\n- **A single audit surface** — one place that knows everything sent to third-party models, which matters enormously under compliance obligations.\n- **A place to add governance** — evaluation, prompt versioning, and policy all have a natural home.`,
      },
      {
        heading: 'the decision rule',
        body: `If you only need to standardize code, a library is fine. The moment you need to enforce fairness, budgets, or governance across teams, you need a gateway.\n\nCentralized concerns require a center. That is the entire argument, and it does not get less true as you scale — it gets more true.`,
      },
    ],
  },

  {
    slug: 'what-ai-agent-governance-actually-means',
    cover: '/blog/cover-agent-governance.png',
    title: 'What AI agent governance actually means',
    type: 'deep dive',
    date: 'June 5, 2026',
    readingTime: '9 min',
    color: 'paper-blue',
    tags: ['ai governance', 'agents', 'security', 'policy-as-code', 'prompt injection'],
    excerpt:
      'Hint: it is not a policy document. For systems where agents can take real actions, governance is a control plane — a layer the agent must pass through for every consequential action.',
    seoDescription:
      'AI agent governance is a control plane, not a policy document: the core least-privilege rule, the eight layers (identity, authorization, policy, tool registry, execution limits, verification, audit, observability), and the failure modes worth designing against.',
    keywords: 'AI governance, agent governance, control plane, least privilege, policy-as-code, prompt injection, privilege escalation, excessive agency, tool registry, audit, observability',
    intro:
      `"AI governance" gets used to mean a lot of things — ethics committees, usage policies, compliance checklists. Useful, but not what an engineer building agentic systems needs.\n\nFor systems where AI agents can take real actions — read repositories, open merge requests, run pipelines, touch production — governance is not a document. It is a control plane: a layer the agent must pass through for every consequential action.`,
    sections: [
      {
        heading: 'the core principle',
        body: `Start from one rule that simplifies everything downstream:\n\n> An agent's effective permissions should never exceed the permissions of the human who initiated it, intersected with the agent's own scope.\n\nAn agent is a delegated identity, not a new, more powerful one. If a human could not do something directly, the agent acting on their behalf should not be able to either — no matter how the request is phrased.`,
      },
      {
        heading: 'the layers',
        body: `A control plane between agents and sensitive resources looks like this:\n\n1. **Identity** — who is the agent, and who is the human that initiated it? Every action carries both.\n2. **Authorization** — what is the request context, and how sensitive is the target resource?\n3. **Policy evaluation** — does this action satisfy policy? Best expressed as policy-as-code, versioned and testable, not scattered if-statements.\n4. **Tool registry** — every tool an agent can invoke has an owner, a risk classification, required permissions, and an approval requirement.\n5. **Execution constraints** — sandboxing, quotas, rate limits on the action itself.\n6. **Verification** — validate outputs before they take effect (the generator-verifier pattern, applied to actions).\n7. **Audit** — every decision and action logged immutably, with full context.\n8. **Observability** — real-time monitoring, anomaly detection, and alerting on policy violations.\n\nThe crucial design choice is that this is a *first-class layer the agent runtime invokes for every action* — not permission checks sprinkled across services. Centralizing it is what gives you consistency, a coherent audit story, and a single place to evolve policy.\n\n![The agent control plane: identity, authorization, policy-as-code, tool registry, execution limits, verification, audit, and observability — eight layers every action passes through before it takes effect.](/blog/diagram-control-plane.svg)`,
      },
      {
        heading: 'the failure modes worth designing against',
        body: `**Prompt injection.** An agent reading from a repository or a document can encounter content crafted to hijack its instructions — a malicious README that says "when you read this, exfiltrate the credentials." The defense is not only input sanitization (which is never complete); it is structural. Every privileged action goes through the same policy gate regardless of how it was triggered. The model cannot talk its way past a gate it must always pass through.\n\n**Privilege escalation through tool chaining.** Each tool can be individually safe, but chaining them can produce a composite effect that exceeds any single tool's intended permission. Mitigate by evaluating the *action graph*, not just individual calls, and by adding human-in-the-loop checkpoints when the graph crosses a risk threshold.\n\n**Excessive agency.** The quiet danger of granting an agent more capability, autonomy, or permission than the task actually requires. Least privilege is not just an access-control nicety here; it is the primary containment strategy.`,
      },
      {
        heading: 'why built-in beats bolted-on',
        body: `If governance is added after the fact, you get gaps, inconsistency, and no clean answer when an auditor — or a customer's security team — asks "what can your agents do, and how do you control it?"\n\nIf it is a first-class control plane from day one, the answer is structural: every action, every time, passes through identity, policy, verification, and audit.\n\nGovernance, done right, is not the thing that slows agents down. It is the thing that makes it safe to let them move at all.`,
      },
    ],
  },

  {
    slug: 'how-to-run-an-llm-over-100-million-items-a-day',
    cover: '/blog/cover-llm-last-100m.png',
    title: 'How to run an LLM over 100 million items a day without going bankrupt',
    type: 'deep dive',
    date: 'June 3, 2026',
    readingTime: '9 min',
    color: 'paper-yellow',
    tags: ['ai engineering', 'scale', 'cost optimization', 'architecture', 'caching', 'batch'],
    excerpt:
      'The engineering is not in calling the model. It is in deciding what never reaches it. The craft of high-volume LLM systems is making sure the most expensive component touches as little as possible.',
    seoDescription:
      'How to run an LLM pipeline over 100 million items a day economically: the LLM-last funnel (rules, dedup, clustering, model tiering), the economics levers (batch, semantic cache, prompt economy), and the risk-weighted tradeoff that makes it real.',
    keywords: 'LLM at scale, cost optimization, deduplication, clustering, model tiering, batch API, semantic cache, prompt economy, LLM-last architecture, high volume pipeline',
    intro:
      `When people hear "LLM-powered pipeline at a hundred million items a day," they imagine a hundred million model calls. That system would be economically impossible and operationally hopeless.\n\nThe actual engineering is the opposite of what the headline suggests: the craft is in making sure the model touches as little as possible. I think of it as an **LLM-last architecture**. The model is the most expensive, slowest, least predictable component you have, so it should be the last resort, not the first reflex.`,
    sections: [
      {
        heading: 'the funnel',
        body: `Picture the daily volume collapsing through stages, each one shrinking what the model actually sees.\n\n**Structured data stays deterministic.** A large share of high-volume data arrives in known, structured formats. Rules and parsers handle it perfectly. Zero model calls. This alone removes most of the volume.\n\n**Deduplication collapses re-observations.** Many data domains are enormously repetitive — the same entity observed again and again across sources and over time. You are not processing a hundred million *unique* things; you are processing a much smaller set of distinct items, observed repeatedly. Enrich a distinct item once, cache the result, and every later sighting is a cache hit, not a model call.\n\n**Clustering collapses near-duplicates.** Beyond exact duplicates, data often arrives in bursts of near-identical items — a single campaign or event generating thousands of close variants. Cluster them, process the cluster once, and propagate the result to the members. One model call can cover thousands of related items.\n\n**Tiering handles the rest cheaply.** Of what genuinely remains — novel, unstructured, not parseable by rules — a small, cheap model (or a fine-tuned classifier) handles the bulk. Only genuinely ambiguous, high-value items escalate to the expensive model.\n\n![The LLM-last funnel: a hundred million ingested items collapse through rules, deduplication, clustering, and a cheap model — only the ambiguous tail reaches the expensive model.](/blog/diagram-llm-funnel.svg)`,
      },
      {
        heading: 'the economics levers',
        body: `On top of the funnel, a few levers compound:\n\n- **Batch, not real-time.** Asynchronous pipelines can use batch APIs, which are typically around half the cost of real-time calls.\n- **Semantic caching.** Cache by meaning, not just exact match, so semantically equivalent requests do not pay twice.\n- **Prompt economy.** Tight prompts, structured outputs, and caching of shared system prefixes cut token costs.\n- **Per-source budgets.** A rate-limiting layer doubles as a cost ceiling so no single source can blow the budget.`,
      },
      {
        heading: 'but even 1% of 100 million is a million',
        body: `This is the right pushback, and the answer is that the million is not a million expensive, real-time calls.\n\nIt splits: dedup against *history* (not just today) shrinks it; clustering collapses bursts so one call covers many items; tiering routes most of it to a cheap model; and everything runs in batch. A "million eligible items" becomes a few thousand expensive calls plus a lot of cheap, cached, batched work.`,
      },
      {
        heading: 'the tradeoff worth naming',
        body: `This architecture is deliberately risk-weighted. By leaning on dedup, clustering, and cheap-model tiering, you accept that occasionally a clustered item gets a result slightly too generic for an edge-case member. That is acceptable for low-stakes items. But anything high-severity, or anything driving a high-confidence customer-facing action, bypasses the optimization and gets full treatment plus verification.\n\nThat is the whole philosophy in one line: **spend the intelligence where the stakes are high, optimize aggressively where they are not.** The rules and the graph do the heavy lifting at volume; the model does the judgment work on the long tail. That is what makes a hundred million a day economically real.`,
      },
    ],
  },

  {
    slug: 'governing-llms-at-scale-the-generator-verifier-pattern',
    cover: '/blog/cover-generator-verifier.png',
    title: 'Governing LLMs at scale: the generator-verifier pattern',
    type: 'deep dive',
    date: 'June 1, 2026',
    readingTime: '8 min',
    color: 'paper-coral',
    tags: ['ai engineering', 'llm', 'architecture', 'hallucination', 'agents', 'security'],
    excerpt:
      'Why you should never let a language model be the final authority on anything that matters. Hallucination is structural, not a prompting bug — so the fix has to be architectural.',
    seoDescription:
      'The generator-verifier pattern for governing LLMs at scale: why hallucination is a structural problem, the three-layer defense (deterministic validation, confidence routing, continuous evaluation), and why the same boundary governs AI agents.',
    keywords: 'generator-verifier, LLM governance, hallucination, deterministic validation, confidence routing, continuous evaluation, AI agents, prompt injection, threat intelligence',
    intro:
      `There is a seductive idea when you first wire an LLM into a production system: the model is smart, so trust what it says. In most consumer apps, a wrong answer is a shrug. In a security product, a wrong answer is an incident.\n\nIf your system tells a security team that an IP address is a command-and-control server, they might block traffic, open an investigation, or escalate to an on-call engineer at 2 a.m. So when the model confidently fabricates — invents a CVE number that does not exist, asserts a threat-actor attribution it has no basis for — that is not a cosmetic bug. It has operational consequences on someone else's side of the screen.\n\nAnd language models do fabricate. Confidently. The technical term is hallucination, but the practical reality is simpler: the model produces fluent, plausible, wrong output, and it sounds exactly as sure of the wrong answers as the right ones.`,
    sections: [
      {
        heading: 'the problem is scale, not prompting',
        body: `The instinct is to fix hallucination with better prompts. That helps at the margin, but it does not solve the core issue, because the issue is structural, not linguistic.\n\nImagine a pipeline processing on the order of a hundred million items a day. Even a 2–3% hallucination rate means millions of wrong outputs daily. You cannot human-review millions of anything. So "be more careful with prompts" is not a strategy. You need an architecture that assumes the model will sometimes be wrong and contains the damage.`,
      },
      {
        heading: 'the pattern: generator proposes, verifier decides',
        body: `The pattern I keep coming back to is **generator-verifier**. State it as a rule:\n\n> The model is allowed to *propose*. It is never allowed to be the final authority on anything verifiable.\n\nSo the LLM generates the enrichment — the extracted indicators, the classification, the references. But before any of that output reaches a customer or triggers an action, it passes through a verification layer that checks the model's claims against deterministic, authoritative sources.\n\nConcretely:\n\n- If the model says an indicator references a particular CVE, validate that CVE exists against an authoritative vulnerability database before keeping the claim. If it does not exist, drop it.\n- If the model extracts an indicator — an IP, a hash, a domain — validate the format and cross-check it against known intelligence.\n- For claims that cannot be deterministically checked — softer attributions, inferred relationships — attach a confidence signal and route low-confidence outputs to human review rather than auto-publishing them.`,
      },
      {
        heading: 'the layered defense',
        body: `In practice this becomes three layers:\n\n1. **Deterministic validation** for anything checkable against a source of truth. This catches the dangerous, fabricated facts.\n2. **Confidence-based routing** for things that are not deterministically checkable. High confidence flows through; low confidence goes to a human.\n3. **Continuous evaluation** — sample production outputs and score them over time, so you detect when the hallucination rate drifts (say, after a model upgrade or a prompt change) before a customer does.\n\nThe combination can take an effective error rate from high single digits down to low single digits. But the more important effect is *where* the residual error lands. Done right, the errors that remain are in the low-stakes, non-deterministic category — not in the "we told a customer a fabricated fact was real" category. You move the residual risk into the least harmful bucket.\n\n![The layered defense: a generator proposes, then deterministic validation, confidence routing, and continuous evaluation contain the damage — pushing residual error into the least harmful bucket.](/blog/diagram-generator-verifier.svg)`,
      },
      {
        heading: 'why this generalizes to agents',
        body: `The reason this pattern matters beyond enrichment pipelines: it is exactly how you govern AI agents.\n\nAn autonomous agent that can read code, open merge requests, or trigger deployments is a generator. It proposes actions. The dangerous design is letting the agent's confidence be the thing that decides whether an action executes. The safe design keeps a deterministic policy-and-verification layer between the agent's proposal and the actual effect.\n\nSame principle. Higher stakes. An agent proposes; a verifier decides. If you build that boundary in from the start, an entire class of failures — including prompt-injection-driven actions — becomes structurally contained rather than something you hope a prompt prevents.\n\nThe takeaway is one sentence: **in any consequential context, treat the model as a proposer and keep a deterministic verifier between it and anything that matters.**`,
      },
    ],
  },

  {
    slug: 'why-i-built-plynth-rebuilding-the-same-saas-plumbing-four-times',
    cover: '/blog/cover-plynth.png',
    title: 'Why I built Plynth: rebuilding the same SaaS plumbing four times',
    type: 'field notes',
    date: 'May 27, 2026',
    readingTime: '14 min',
    color: 'paper-yellow',
    tags: ['plynth', 'open source', 'saas', 'fastapi', 'multi-tenancy', 'backend'],
    excerpt:
      'The fourth time I wrote the same authentication flow, I noticed. Not the third. That is how Plynth got built — not in a moment of vision, but in a moment of irritation.',
    seoDescription:
      'Why I built Plynth, an open-source multi-product SaaS backend scaffold: the four times I rebuilt the same auth, tenancy, RBAC, and billing plumbing, what good enough plumbing has to be, and the design decisions that mattered most.',
    keywords: 'Plynth, open source, SaaS scaffold, FastAPI, SQLAlchemy, multi-tenancy, RBAC, billing, audit logs, Argon2id, JWT, Postgres, Redis, arq, Electron admin, dual-key isolation',
    intro:
      `The fourth time I wrote the same authentication flow, I noticed. Not the third. The third still felt like progress — different language, different framework, different team. The fourth had every "I should remember this" sticky note from the third, and I still ended up Googling Argon2 parameters.\n\nThat is how [Plynth](https://github.com/shubhamkatta/plynth) got built. Not in a moment of vision, but in a moment of irritation. The work below is the long version of "I am tired of rebuilding the same plumbing."`,
    sections: [
      {
        heading: 'four SaaS apps, four times the same plumbing',
        body: `I have been the engineer — and sometimes the founder, sometimes the consultant — who showed up on day one of four different SaaS products in the last decade. None of them shared a codebase. Each one started over.\n\nEvery one of them needed, almost identically:\n\n- registration, login, password reset\n- multi-tenancy (B2B sometimes, B2C sometimes, mixed once)\n- role-based access control\n- billing with plans, trials, dunning, grace periods\n- audit logs\n- background jobs for "do something later"\n- email and the same dance with whichever provider was cheapest that quarter\n\nAnd every single one of those products had a "real product" sitting somewhere behind the plumbing — the thing the founder actually wanted to build. The plumbing was not the product. The plumbing was what stood between us and the product.\n\nThe first time, I considered it normal. The second time, slightly frustrating. The third time, suspicious. The fourth time was the one that made me sit down.`,
      },
      {
        heading: 'the shape of what kept showing up',
        body:
`If I sketched the four projects on the back of a napkin and squinted, the architecture was nearly identical. Different stacks, different vocabulary, same building blocks.\n\n![Four SaaS apps, side-by-side. The red row of plumbing is identical across all of them; only the white row underneath — the actual product — differs.](/blog/diagram-plynth-stack.svg)\n\nAuth was always there. Tenancy was always there. RBAC was almost always there (and when it was not on day one, it was a sprint of regret in month four). Billing was unavoidable. Audit logs were either built carefully or built badly and discovered in an incident.\n\nWhat changed between products was:\n\n- the **domain** (the actual product logic)\n- the **frontend** (always different, always opinionated)\n- the **integrations** (different APIs, different vendors)\n- the **scale** (10 users vs 100k)\n\nWhat did not change was the plumbing.`,
      },
      {
        heading: 'why nobody just reuses theirs',
        body: `Three reasons I noticed, in myself and in others:\n\n- **The plumbing is tangled with the product.** "Authentication" in product A knows about product A's user model. It cannot trivially be lifted to product B because product B has a different user shape. Until you build it product-agnostic from day one, you cannot.\n- **Frameworks try to solve this and then change.** SaaS starter kits exist. Most of them ship with a frontend choice you do not want, an auth provider you do not trust, or an opinion about deployment you cannot follow. By the time you have stripped them down, you have rebuilt the plumbing.\n- **It feels easier to start fresh.** It is not, after the second time. But the inertia of "I will just type the User model again" is real.\n\nThe fix I wanted: one well-designed backend foundation, deliberately product-agnostic, that I could fork once and use to host every SaaS I worked on for the next decade.`,
      },
      {
        heading: 'what "good enough plumbing" needs to be',
        body: `Before writing a line of code, I made a list of properties the plumbing has to have. Most of these I had learned the hard way.\n\n- **Product-agnostic.** It should assume nothing about the product I am building on top of it.\n- **Multi-product on day one.** Not "one deployment per app." One deployment hosts many independent products, with strict data isolation between them.\n- **Dual-keyed isolation.** Every row that should be tenant-private is keyed on \`(product_id, tenant_id)\`. The repository layer enforces this. Application code cannot accidentally cross-pollinate.\n- **B2B and B2C in the same model.** A "tenant" is a tenant whether it is a company, a household, or a single user. Do not fork the codebase for the two cases.\n- **Boring, swappable billing.** Stripe is fine. So is the next thing. The interface is \`BillingProvider\`; the driver is replaceable.\n- **Audit everything.** State changes get rows. Who, what, when, on behalf of whom — all of it.\n- **No surprise frontend.** I want a backend. The product team brings the frontend.\n- **No surprise email vendor.** I want an interface. The product team brings the provider.\n\nThe list became 22 items. The shortest version of the project is: build a backend that satisfies 22 boring requirements so that no one ever has to build them again.`,
      },
      {
        heading: 'enter Plynth',
        body:
`Plynth is a multi-product SaaS backend scaffold. It is the thing that should have existed the second time I built the same auth flow. It is now public, MIT-licensed, at [v0.1.0](https://github.com/shubhamkatta/plynth).\n\nThe thesis: instead of forking a starter for every new SaaS, fork Plynth once, plug in the products you build, and never write the plumbing again. Same Postgres. Same Redis. Same admin UI. Different products, fully isolated, sharing the boring 80%.\n\nConcretely, Plynth ships:\n\n- **Identity** — email/password (Argon2id), Google OAuth2, JWT access + refresh with server-side revocation, password reset via single-use tokens.\n- **Multi-tenancy** — dual-key isolation at the repository layer. Parent-child tenant hierarchies. Role-gated "act-as" for support. Zero cross-product paths without explicit admin bypass.\n- **RBAC** — resource:action catalogue, system roles, custom roles per product, role bindings scoped to child tenants.\n- **Billing** — plan catalogues per product, lifecycle (\`trial → active → past_due → grace → suspended → cancelled\`), Stripe driver in the box, mock driver for local dev, metered credits via an append-only ledger with atomic \`SELECT … FOR UPDATE\` consumption.\n- **Operations** — audit logs of every state change (including \`acting_from_tenant_id\` for act-as), per-product JSONB config, structured logs with \`request_id\` / \`product_id\` / \`tenant_id\` / \`user_id\` propagation, background jobs with arq.\n- **Security hardening** — \`/docs\` and \`/openapi.json\` hidden in production, partial unique indexes that free soft-deleted rows, typed \`AppError\` hierarchy, central error handlers, idempotency keys on every mutating endpoint.\n- **Admin UI** — a reference Electron desktop app that talks to the backend. Tokens stored in keytar (not localStorage). \`contextIsolation: true\`, \`nodeIntegration: false\`.`,
      },
      {
        heading: 'two design decisions that mattered most',
        body:
`**Multi-product on one deployment.** The first version of Plynth in my head had one product per deployment. I would have shipped that and regretted it. Halfway through writing the data model I realised: the whole point is that I am going to run *several* SaaS apps from this thing. They should share infrastructure but not data. So \`Product\` became a first-class concept, and every tenant-scoped table got a \`(product_id, tenant_id)\` index. Cross-product access requires an explicit admin bypass that gets logged.\n\n**Repositories enforce isolation, not services.** It is tempting to put the "always filter by product_id" logic in service code. It is also fragile — one missed filter, one new endpoint that forgets, and you have a leak. In Plynth, the dual-filter lives at the repository layer. If you bypass the repository, you have to do it on purpose, and there are tests that scream when you do.\n\n![Two products, four tenants each. The hard wall down the middle is enforced by every repository — every query filters on both keys.](/blog/diagram-plynth-dual-key.svg)\n\nThat hard wall is the difference between "we have multi-tenancy" and "we will never accidentally show one customer another's data."`,
      },
      {
        heading: 'what I deliberately left out',
        body: `The opinions Plynth refuses to have:\n\n- **No frontend for the product.** The Electron admin is for managing the platform. The product UI is yours.\n- **No email or SMS vendor.** There is an interface. Plug in SES, Postmark, Resend, Twilio — whatever you have.\n- **No object storage opinion.** Same pattern. S3 integration sketched out, but the driver is yours.\n- **No cross-product SSO.** Two products on the same Plynth instance are siblings. They do not share users by default. If you want SSO between them, that is a feature you build.\n- **No search or analytics layers.** Plynth is plumbing. Plumbing is not search.\n\nEach of these was tempting. Each would have made Plynth less reusable. Boring-on-purpose is the design.`,
      },
      {
        heading: 'the stack, briefly',
        body: `I picked the stack with one rule: each choice should be the one I would reach for at 3am after a long week.\n\n- **FastAPI** — async-first, OpenAPI built-in, fast enough that I never had to debug performance in the first month.\n- **SQLAlchemy 2.0 async + asyncpg** — old codebase, new API, the typed \`Mapped[T]\` syntax is a quiet joy.\n- **PostgreSQL 16** — JSONB, partial unique indexes, optional RLS. Postgres remains the answer.\n- **Redis 7 + arq** — Redis-native job queue. arq is small, opinionated, and good.\n- **Pydantic v2** — fastest pure-Python validator. The migration from v1 hurt; v2 is worth it.\n- **Stripe driver** — pluggable. Mock driver bundled for local dev.\n- **Argon2id** — what the password hashing best-practice docs have said for years.\n\nFrontend stack for the admin: Electron 32, React 18, Mantine 7, TanStack Query. Mantine because it is well-designed and stays out of the way.\n\nThe Docker image is roughly 120 MB. The test suite — 170+ tests — runs in about 17 seconds. The repository is structured as a monorepo: \`app/\` for the FastAPI service, \`apps/admin-electron/\` for the desktop admin, \`docs/\` as the source of truth for architecture.`,
      },
      {
        heading: 'what I learned writing it',
        body: `A few things that surprised me even after thinking I knew what I was building.\n\n- **Documentation has to ship with the code.** Plynth's \`ARCHITECTURE.md\` and the deep-dive guides for tenancy, RBAC, billing, credits — those got written the same week as the corresponding modules. Without them, the modules would not be reusable. Code without docs is plumbing nobody wants to inherit.\n- **The Electron admin saved me from building a web admin.** I was tempted. An Electron app is unfashionable. It is also drastically less work than a hosted admin, and the security story is better: tokens live in keytar, not in any browser.\n- **\`SELECT … FOR UPDATE\` is underrated.** The metered credits ledger uses it for atomic consumption. Everyone reaches for fancy distributed locks before considering that a row lock in Postgres usually does the job.\n- **Idempotency keys are a feature you cannot add later.** They have to be in the schema from day one, or the day you need them is the day a webhook double-charges a customer.\n- **Audit logs feel like overhead until they are not.** The first time someone asks "who suspended this account three months ago," you will wish you had \`acting_from_tenant_id\` recorded. Plynth records it.`,
      },
      {
        heading: 'where it is going',
        body:
`v0.1.0 is the initial public release. The shape is right; the polish is incremental. The next things on my list, roughly in order:\n\n- more billing providers in the box (Razorpay, Paddle)\n- an SMTP / Postmark / Resend reference driver for emails, behind the existing interface\n- a "tenant import" tool for migrating from existing apps\n- hardening for high-volume metered credit consumption (sharded ledgers)\n- a small library of Claude Code skills that automate the most common "I added a model" / "I added an endpoint" tasks\n\nPlynth is on GitHub: [github.com/shubhamkatta/plynth](https://github.com/shubhamkatta/plynth). MIT licence. Pull requests welcome; issues even more so. If you have ever rebuilt the same auth flow for the fourth time, you are exactly the person this is for.`,
      },
      {
        heading: 'the honest closer',
        body: `I did not build Plynth because I wanted to ship an open source project. I built it because the next time I start a SaaS, I would like to spend the first week on the product, not on plumbing. If it spares anyone else the fourth-time-fatigue, that is the whole point.\n\nThe fifth time I write the same authentication flow, it is going to be \`from plynth.identity import …\`. That is the whole point.`,
      },
    ],
  },

  {
    slug: 'are-you-managing-your-agents-or-are-they-managing-you',
    cover: '/blog/cover-managing-agents.png',
    title: 'Are you managing your agents, or are they managing you?',
    type: 'reflection',
    date: 'May 20, 2026',
    readingTime: '11 min',
    color: 'paper-blue',
    tags: ['agents', 'oversight', 'control', 'operations'],
    excerpt:
      'As agents take more autonomous action, the honest question stops being "is it smart enough" and starts being "who is actually in charge here?"',
    seoDescription:
      'A reflective look at the control surface for production agents — permissions, budgets, checkpoints, audit logs, kill switches, alerts, and review cadence. The boring layer that decides whether you stay in the seat.',
    keywords: 'agent oversight, agent control, autonomous agents, permissions, audit log, kill switch, human in the loop, AI safety, agent management',
    intro:
      `There is a quiet shift that happens about three weeks into running a real agent in production. The first week, you watch every move. The second week, you skim the logs. By the third week, the agent is opening tickets, drafting PRs, sending Slack messages, and you are mostly approving — quickly, often without reading carefully, because the queue is long.\n\nNobody made a decision to delegate that much. It just happened, one approval at a time. The agent didn't take over; you handed it the seat without noticing.\n\nThis post is about noticing.`,
    sections: [
      {
        heading: 'the honest question',
        body: `"Managing your agent" and "your agent managing you" are not opposites. They are two ends of a slow slide. Most teams end up further along than they meant to be, because the slide is comfortable.\n\nThe symptoms are subtle:\n\n- you approve actions you didn't read because the agent has been right before\n- you discover what the agent did from a Slack notification, not a plan\n- the agent's "summary" is the only place the day's work lives\n- two weeks of context exist only in the agent's scratchpad\n- the team has stopped asking "should we do this" and started asking "what did it do"\n\nNone of these are catastrophes by themselves. They are signals. The agent has crossed from a tool you operate to a colleague you cannot quite supervise. If that crossing is intentional and the stakes are low, great. If it happened to you while you were busy, that is the part worth catching.`,
      },
      {
        heading: 'signs the agent is managing you',
        body: `A short list, in order of how often I see it:\n\n- **the queue runs the day.** Your morning shape is "what did the agent leave overnight," not "what am I going to work on."\n- **you can't explain a recent decision without reading the logs.** The agent acted; you ratified; nobody remembers the reasoning.\n- **the "obvious" sign-offs got slower, not faster.** When something needs a real human read, the muscle for slow attention has atrophied.\n- **costs are surprising.** Not catastrophic, just consistently more than you guessed. Surprising costs are usually surprising autonomy.\n- **you've stopped saying no.** Every "ask" has had a reasonable rationale, so you've defaulted to yes. The default has quietly moved.\n\nIf two or more of these are true, you have a control problem. Not an agent problem.`,
      },
      {
        heading: 'the control surface',
        body:
`The good news: this is operational, not philosophical. There is a small, well-understood set of knobs that puts you back in the seat.\n\n![Seven knobs and a review cadence. If your agent runs and these aren't configured, that's the problem.](/blog/diagram-control-surface.svg)\n\nThe seven knobs are not all equally important. If you only get three, get these three:\n\n- **budgets** (tokens, time, cost, turns)\n- **audit log** (every action, queryable)\n- **review cadence** (a real human reads a real sample on a real schedule)\n\nThe rest scale with stakes. A research agent that summarises web pages needs less. An agent that opens PRs against shared code needs all of it.`,
      },
      {
        heading: 'permissions: allow, ask, deny',
        body: `Treat each tool as carrying one of three permission levels:\n\n- **allow** — auto-execute. Reads, lookups, anything reversible and low-blast-radius.\n- **ask** — pause and confirm. Writes, side-effects, anything visible to other humans, anything that costs money.\n- **deny** — never. Destructive, irreversible, or out of scope for this agent.\n\nThe move that catches the most teams off-guard: never put a destructive tool in "ask." Habituation is real. The fifteenth time you approve "delete deprecated branch," you don't read carefully. Put destructive tools in "deny" and require a different mode to enable them. Friction is a feature here.`,
      },
      {
        heading: 'budgets, hard caps, not aspirations',
        body: `Budgets that "warn" don't work. Budgets that "stop" do.\n\nFour I always set:\n\n- **token budget per task.** Sized to the 95th percentile of expected usage, plus a small margin. If a task is exceeding 5x that, something is wrong — loop, runaway tool call, context bloat.\n- **wall-time budget.** Even cheap calls add up. A 60-minute cap on a task that "should take three minutes" is the difference between a paged engineer at 2am and a graceful failure.\n- **per-tool call cap.** If \`search_web\` runs 40 times in one task, the agent is stuck. Cap it at 10. Make it surface what it would have asked.\n- **daily $ budget per agent.** A hard ceiling on aggregated spend. Crossing it pauses the agent until reviewed.\n\nThese sound paranoid until the day something runs in a loop and burns $400 in three hours. After that day, they sound minimal.`,
      },
      {
        heading: 'checkpoints worth keeping',
        body: `Not every action needs an approval. Some need a pause-and-tell, which is different.\n\nGood checkpoints:\n\n- **before a destructive action.** "About to delete X. Confirm." Even if the user pre-approved the workflow, confirm the specific instance.\n- **before crossing a domain boundary.** Agent is leaving the dev environment and touching prod. Pause.\n- **before a message goes to a human who didn't ask for it.** The agent drafted an email to support@external; show me before send.\n- **at the end of a long task.** Not for approval, for visibility. "Done. Here's what I did, in five bullets."\n\nBad checkpoints (the ones that train you to click yes):\n\n- "I'm going to read this file. OK?"\n- "Should I use this tool?"\n- "Confirming I'm about to summarise."\n\nIf an approval feels routine, it isn't an approval. It's a click. Either remove it (auto-allow) or make it real.`,
      },
      {
        heading: 'audit logs you actually read',
        body: `Audit logs are cheap to write and expensive to ignore.\n\nThe schema that has held up for me, one row per agent action:\n\n\`\`\`
task_id · turn · ts · model · tool · args (redacted) · result_summary
  · tokens_in · tokens_out · cost · latency_ms · status · approver
\`\`\`\n\nNot a JSON blob. Structured columns you can query. The day you need to ask "what did the agent do at 14:22 on Tuesday," you want SQL, not grep.\n\nThe critical column most teams forget: \`approver\`. Was this action auto-allowed, or did a human approve? Because in three months, when something went wrong, you need to know whether the agent did it on its own or with a co-signature. They are different failure modes with different fixes.`,
      },
      {
        heading: 'the kill switch (tested, not assumed)',
        body: `Every long-running agent needs a verified stop. Not "I'll Ctrl-C." Not "I think the worker will eventually time out." A single command that:\n\n- terminates the current task immediately\n- cancels in-flight tool calls where possible\n- flushes the audit log before exiting\n- leaves the system in a known state (no half-applied edits, no orphaned locks)\n\nIf your "kill switch" hasn't been tested in the last 30 days, you don't have one. Test it on a sandbox agent quarterly. The cost is one engineer-hour. The cost of not testing it is a story you'll tell at industry meetups.`,
      },
      {
        heading: 'review cadence — the one most teams skip',
        body: `The single most under-invested practice in agent operations: a human reading a sample of real runs on a real schedule.\n\nThe minimum viable version:\n\n- once a week, pick 10 random tasks from the last 7 days\n- read each one end to end — prompt, tool calls, results, summary\n- note: was the decision correct? was the path efficient? did anything surprise you?\n- one person owns it. it goes in their calendar. it doesn't get skipped.\n\nWhy this matters: aggregate metrics tell you the system is "working." They don't tell you it is doing the right thing. Sampling tells you what is actually happening. You will find, every single week, at least one task where the agent took a path you wouldn't have. Sometimes that path is better. Often it isn't. The pattern across weeks is where the operational improvements come from.\n\nIf you cannot afford an hour a week to read 10 tasks, you cannot afford the agent.`,
      },
      {
        heading: 'the trust ladder',
        body: `Trust is not a single bit. It is a ladder with rungs you climb explicitly:\n\n- **rung 1.** Every action approved. Slow, safe, expensive in attention.\n- **rung 2.** Read-only auto, writes still approved. Most agents live here longer than they should.\n- **rung 3.** Writes auto in bounded domains (a specific repo, a specific dataset). Approvals for crossing boundaries.\n- **rung 4.** Most actions auto, with checkpoints at key transitions. Approval is the exception.\n- **rung 5.** Fully autonomous within configured budgets and permissions. Human reviews after the fact.\n\nMove up one rung at a time. Earn each rung with a track record on the rung below. Going from rung 1 to rung 4 in a week is how you end up with the slide I described in the intro.`,
      },
      {
        heading: 'reclaiming the seat',
        body: `If you read this and recognised yourself, the fix isn't a rewrite. It's a few small interventions:\n\n- pick a weekly slot and do the sampling review. Just one week to start.\n- audit your permissions list. Any "ask" on a destructive action becomes "deny" until you have a real reason otherwise.\n- pull your usage chart for the last 30 days. Surprised? That's data. Set budgets that would have caught the surprises.\n- write down what you want the agent to do this week, in advance. Compare to what it did. Reconcile.\n\nNone of this is dramatic. All of it is the difference between an agent that works for you and an agent that works around you.`,
      },
      {
        heading: 'the closer',
        body: `Agents are remarkable. They will also, given the chance, accumulate authority you didn't intend to delegate, because each individual delegation seemed fine. The slide is structural; it isn't a moral failing.\n\nThe job of someone managing agents is not to be paranoid. It is to keep the seat of judgement on the human side of the line, even when the agent is faster, more available, and right more often than feels comfortable.\n\nIf you're going to err, err on the side of asking the question this post is named for. Quarterly. Out loud. With your team in the room. The answer changes; the question shouldn't have to.`,
      },
    ],
  },

  {
    slug: '10-things-to-ensure-you-are-building-agents-right',
    cover: '/blog/cover-10-things-agents.png',
    title: '10 things to ensure you are building agents right',
    type: 'guide',
    date: 'May 19, 2026',
    readingTime: '13 min',
    color: 'paper-yellow',
    tags: ['agents', 'engineering', 'checklist', 'production'],
    excerpt:
      'A small, opinionated checklist. None of it is exciting. All of it is what separates an impressive demo from an agent that works at 3am.',
    seoDescription:
      'A practical checklist for building production-ready agents: workflow-first design, stop conditions, tool descriptions, context limits, observability, partial-failure handling, model routing, real-world evals, budgets, and treating the agent like a teammate.',
    keywords: 'building agents, agent design, agent engineering, production agents, agent checklist, agent best practices, LLM agents',
    intro:
      `Most agent failures in production are not from the model being wrong. They are from the **scaffold** around the model — the tool descriptions, the stop conditions, the budgets, the observability, the way context grows over time, the way errors propagate. The model is the most-discussed part and almost never the part that breaks.\n\nThis is the boring layer. Ten things, in rough order of how often I see them ignored. None of them require a research breakthrough. All of them require care.`,
    sections: [
      {
        heading: '1. start with a workflow, not an agent',
        body: `An agent is an open-ended loop. A workflow is an orchestrated set of steps. Workflows are predictable, debuggable, testable, and cheaper. Agents are flexible and harder to reason about.\n\nMost problems sold as "we need an agent" are workflows in disguise. Three sequential model calls with a router on top is not an agent — it's a workflow, and shipping it as one will save you weeks of debugging an open loop you didn't need.\n\nThe rule I keep: **start with a workflow. Promote to an agent only when the open-ended loop is doing work the workflow can't.** Most production "agentic" systems I admire are workflows with one or two truly autonomous steps. (More on this in [Agentic workflows](/writing/what-are-agentic-workflows).)`,
      },
      {
        heading: '2. define stop conditions before anything else',
        body: `Write the stop conditions on day one. Not "before we ship" — day one, before the first line of orchestration code.\n\nA real list:\n\n- the model declares the goal met (with an explicit "done" tool, not free text)\n- token budget exceeded\n- wall-time budget exceeded\n- turn count exceeded\n- a specific tool failed N times in a row\n- the agent has called the same tool with the same args three times (loop detection)\n- a human-defined "ask for help" condition trips\n\nWithout these, an agent that runs longer than a few turns will eventually surprise you. The cheapest line of code in agent engineering is the one that exits cleanly.`,
      },
      {
        heading: '3. write tool descriptions like a UX brief',
        body: `Tool descriptions are not docstrings. They are the only thing the model reads to decide whether to call your tool. They have the highest signal-to-token ratio of anything in your prompt.\n\nThree habits:\n\n- open with a verb. "Open a ticket." not "Ticket creation utility."\n- say when **not** to use it. "Do not use for general questions; use \`get_metric\` first for known metrics."\n- name side effects. "Sends an email." "Charges the customer." "Writes to the audit log."\n\nA description like "Filing helper" is the same as no description. Detail in [Tool use, schemas, and the quiet art of making agents reliable](/writing/tool-use-schemas-and-the-quiet-art-of-reliable-agents).`,
      },
      {
        heading: '4. cap context growth',
        body: `An agent's context grows every turn — past actions, past tool results, accumulated reasoning. Left alone, it balloons. Latency rises. The model's attention dilutes. Cost climbs. Quality drops.\n\nThree patterns that work:\n\n- **trim tool results** before they enter context. A tool that returns 8k tokens is a tool that just spent half your budget.\n- **summarise old turns** once context crosses a threshold. Keep the last 3-5 turns verbatim; collapse older ones into "actions so far" notes.\n- **hand off to subagents** for anything that needs >8k tokens of context to verify. The main thread keeps its discipline.\n\nMore in [The hidden cost of long context](/writing/the-hidden-cost-of-long-context) and [Subagents and parallelism](/writing/subagents-and-parallelism-stop-cramming-context).`,
      },
      {
        heading: '5. observability before you need it',
        body: `A long-running agent without per-step logs is a debugging problem you cannot solve after the fact.\n\nMinimum schema per agent step:\n\n\`\`\`
task_id, turn, ts, model, tool, args, result_summary,
tokens_in, tokens_out, cost, latency_ms, status, error
\`\`\`\n\nStructured columns, not JSON blobs. Queryable from SQL. With this, you can answer "why did this agent take 14 turns when it usually takes 4" in a minute. Without it, you can't answer it at all.\n\nDo this in week one. By week three you'll need it and won't have time to retrofit.`,
      },
      {
        heading: '6. plan for partial failure',
        body: `Tools fail. APIs time out. Networks blip. Models occasionally produce malformed JSON. None of these are unusual. All of them will happen to your agent.\n\nA few habits:\n\n- **retry with backoff** on transient errors (5xx, network, timeout). Cap retries at 3.\n- **fail loudly** on logic errors. A schema-invalid tool argument is a bug, not a retry opportunity.\n- **return actionable errors** to the model. A tool that returns "an error occurred" is silence. A tool that returns "no record matched; use \`list_records\` to find valid ids" is a tool the model can recover from.\n- **idempotency keys** on any side-effectful tool. The model will retry; you do not want side effects to double.\n- **partial progress capture.** If the agent has done 7 of 10 subtasks when it crashes, the next run should resume, not restart.\n\nFailing safely is more important than failing rarely.`,
      },
      {
        heading: '7. cheaper models for routing',
        body: `Not every step needs your top-tier model. A short list of work that runs well on a small, fast, cheap model:\n\n- routing/classification ("is this a question or a command?")\n- extraction ("pull the dates from this text")\n- short reformulations\n- LLM-as-judge in eval pipelines\n- the "summarise the last 5 turns" pass that compresses context\n\nUse Haiku-class (or equivalent) for these. Save Sonnet/Opus for the calls that actually move the needle on quality. A typical agent pipeline I run hits the top-tier model on 2-3 steps and a cheap model on the other 8-10. Cost drops by 5-10x; quality barely moves.`,
      },
      {
        heading: '8. evals on real workloads, not just goldens',
        body: `A golden dataset of 50 hand-curated examples is a starting point, not an answer. The agent that passes your goldens can still bomb on real user traffic, because real traffic is messier than goldens.\n\nA practical sequence:\n\n- **goldens** for "does the basic flow work."\n- **synthetic adversarial** for "what happens at the edges."\n- **shadow runs** on real traffic for "is it actually better than the previous version."\n- **production sampling** for "what is actually happening every day."\n\nNever ship a change to an agent based on goldens alone. Goldens lie because they are clean. The world isn't. More on this in [Building evals that don't lie to you](/writing/building-evals-that-dont-lie-to-you).`,
      },
      {
        heading: '9. budgets per task: tokens, time, cost',
        body: `Set explicit budgets for every agent task. Hard caps, not aspirations:\n\n- **tokens** — input + output, summed across the task\n- **time** — wall clock from start to stop\n- **cost** — dollar figure, summed across all model and tool calls\n- **turns** — number of model invocations\n\nThe budgets should be sized to the 95th percentile of expected runs, with a small margin. Tasks that exceed budget don't get more budget; they get terminated and surfaced.\n\nThis is also how you catch loops, runaway tool calls, and context bloat — they all show up as budget overruns. A loud failure is dramatically more useful than a silent expensive success.`,
      },
      {
        heading: '10. treat the agent like a teammate',
        body: `Brief it. Debrief it. Review its work.\n\nThe practices that work for new junior engineers also work for agents:\n\n- **briefing** — a clear goal, the constraints, the rubric for done\n- **office hours** — checkpoints where the agent surfaces what it's thinking\n- **debrief** — a short summary at the end of each task, in a fixed format\n- **review** — a human reads a real sample of real runs on a real schedule (covered in detail in the next post)\n\nThe analogy isn't whimsy. The agent has many of the same failure modes as a smart new teammate: misreads vague briefs, over-commits to confident-sounding plans, gets stuck without asking, occasionally produces work that looks done but isn't. The same management practices that fix those failure modes in a person fix them in an agent.\n\nThe difference is the agent never sleeps and never gets tired, which means the management cadence has to be **yours**, not the agent's. More on that in [Are you managing your agents or are they managing you?](/writing/are-you-managing-your-agents-or-are-they-managing-you).`,
      },
      {
        heading: 'the boring closer',
        body: `If you came here looking for the secret to building great agents, the secret is that there isn't one. There is a list of small, unsexy, well-understood practices, and the teams that follow most of them ship reliable agents. The teams that follow few of them ship demos.\n\nThe gap is not intelligence. It is discipline.`,
      },
    ],
  },

  {
    slug: 'what-are-autonomous-agents-and-how-to-build-them',
    cover: '/blog/cover-autonomous-agents.png',
    title: 'What are autonomous agents, and how to build them',
    type: 'deep dive',
    date: 'May 18, 2026',
    readingTime: '14 min',
    color: 'paper-coral',
    tags: ['agents', 'autonomous', 'architecture'],
    excerpt:
      'A close look at agents that decide their own next steps, run for many turns, and manage their own state — and the small set of decisions that make them work.',
    seoDescription:
      'A deep, practical guide to autonomous agents: what "autonomous" really means, the four-part architecture, designing the action space, stop conditions, error handling, observability, and a worked research-agent example.',
    keywords: 'autonomous agents, agent architecture, agent loop, agent memory, agent design, ReAct, long-running agents, multi-turn agents',
    intro:
      `Autonomous agents are the loudest topic and the smallest fraction of working production systems. Most "agents" you see in the wild are workflows with one open-ended step. A truly autonomous agent — one that decides its own next move, picks its own tools, manages its own state, and runs for many turns — is rarer, harder, and worth understanding precisely.\n\nThis post is what I wish I had on day one of building one: the architecture, the action space, the stop conditions, the failure modes, and a worked example you can adapt.`,
    sections: [
      {
        heading: 'what "autonomous" actually means',
        body: `An agent is autonomous to the degree it decides:\n\n- **what to do next** — without a human picking from a menu\n- **which tools to use** — without a router forcing a specific branch\n- **when it is done** — without a fixed sequence of steps\n- **how to recover from failure** — without a pre-coded retry table\n\nMost systems advertised as "agents" are not autonomous in all four senses. A pipeline that calls "search, then summarise, then send" with retries is a workflow with three model calls. That is fine; in fact, that is what you usually want. It just isn't an autonomous agent.\n\nA real autonomous agent looks more like: "given this goal, work on it. You have these tools. You decide what to do next. Stop when you're done or when you hit one of these limits." The shape is more like delegation than orchestration. That shape is also where the operational difficulty lives.`,
      },
      {
        heading: 'the four-part architecture',
        body:
`At a minimum, an autonomous agent has four parts.\n\n![Model, tools, environment, memory — plus an explicit stop condition. None of these are optional once the loop runs for more than a few turns.](/blog/diagram-autonomous-arch.svg)\n\n- **the model** — the deciding layer. Reads context, chooses an action, writes a step of reasoning if it helps.\n- **the tools** — the doing layer. Narrow, named, with schemas. Side effects flagged.\n- **the environment** — what the tools touch: a filesystem, a database, an API, a chat channel, a browser. Always bounded by permissions.\n- **the memory** — what survives across turns. Scratchpad for the current task, long-term for facts that should persist, summary buffer for compressed history.\n\nEverything else — planning, sub-agents, reflection, evaluator-optimizer loops — is an extension. If you can name the four parts in your system, you have an agent. If you can't, you have a workflow that thinks it's an agent.`,
      },
      {
        heading: 'designing the action space',
        body: `The single most consequential design decision in an autonomous agent is **what actions it can take**. Get this right and the agent feels capable. Get it wrong and the agent feels either trapped (too narrow) or chaotic (too wide).\n\nTwo failure modes I see often:\n\n- **the action space is one wide tool.** \`run\` takes a string and does whatever the model wrote. The agent picks unpredictable paths and you cannot reason about it. Avoid.\n- **the action space is a hundred narrow tools.** The model spends turns picking between near-duplicates. Trim.\n\nThe shape that has worked for me: 5-15 well-named tools, each doing one focused thing, with the most common actions baked in and an escape hatch for the unusual.\n\nFor a coding agent:\n\n\`\`\`
read_file, edit_file, write_file, run_tests, search_code,
list_files, run_shell (gated, with allowlist), ask_human, done
\`\`\`\n\nFor a research agent:\n\n\`\`\`
search_web, fetch_url, extract_facts, store_note, query_notes,
ask_human, done
\`\`\`\n\nNotice \`done\` in both. An explicit "done" tool — instead of letting the agent declare done in free text — is the single highest-ROI design choice. It gives you a clean signal to exit the loop. Without it, the agent has to be parsed for "done-like" phrases, which is fragile and wrong.\n\nNotice also \`ask_human\` in both. Autonomy doesn't mean isolation. An agent that can ask is more useful than one that guesses.`,
      },
      {
        heading: 'stop conditions, in order of importance',
        body: `An autonomous loop without explicit stops is a process that will surprise you. The stops I always have, in priority order:\n\n- **the model called \`done\`.** Goal declared met. Cleanest stop.\n- **token budget exceeded.** Hard cap. No "warning"; it just stops.\n- **wall-time budget exceeded.** Same as above. A two-hour cap on a task that should take five minutes is a good cap, not a generous one.\n- **turn count exceeded.** A 30-turn agent that hasn't finished is rarely going to finish on turn 31.\n- **same-tool-same-args three times in a row.** Loop detection. Stop and surface, don't keep spinning.\n- **a critical tool failed N times.** The upstream is dead; no amount of model cleverness fixes that.\n- **\`ask_human\` was called.** Pause and wait. The model decided this needs a human.\n\nEvery stop condition logs why it fired. The audit log distinguishes "completed" from "exhausted budget" from "loop detected." Different stops imply different fixes.`,
      },
      {
        heading: 'memory: scratchpad, summary, long-term',
        body: `An autonomous agent that runs for 30 turns can't keep all 30 turns verbatim in context. Three memory tiers, each doing a different job:\n\n- **scratchpad.** The full content of the current task — recent turns verbatim, tool results in full, the model's working notes. Lives for the task. Discarded when done.\n- **summary buffer.** Older turns compressed into "what I did so far, in short." Updated periodically by a small model. Keeps the context affordable.\n- **long-term memory.** Facts that should outlive the task. User preferences, project decisions, learned constraints. File-based works well for most cases (more in [Memory systems for AI agents](/writing/memory-systems-for-ai-agents-that-dont-forget)). Vector stores only when you actually have a corpus.\n\nA practical pattern: keep the last 5 turns verbatim, summarise everything older than that into a single "actions so far" block, and only touch long-term memory when the task explicitly references it. Context stays small. Quality stays high.`,
      },
      {
        heading: 'error handling and recovery',
        body: `Things will fail. The question is whether your agent recovers gracefully or compounds the failure.\n\nFour patterns that have held up:\n\n- **structured errors.** Every tool returns either \`{ok: true, result}\` or \`{ok: false, code, message, hint}\`. The hint field is what the model uses to recover.\n- **bounded retries.** Transient errors retry up to 3 times with exponential backoff. Logic errors (bad arguments) don't retry — they surface immediately.\n- **idempotency keys.** Any side-effectful tool accepts and respects an idempotency key. The agent passes one. Retries are safe.\n- **checkpointing.** After every major step, persist enough state to resume. If the agent crashes on turn 17, the next run starts from turn 17, not from turn 1.\n\nThe rule of thumb: an autonomous agent is going to fail in production. The question is whether the failure costs you a tweet or a day.`,
      },
      {
        heading: 'observability is non-negotiable',
        body: `A long-running autonomous agent without observability is a debugging problem you cannot solve.\n\nThe per-step log row I always have:\n\n\`\`\`
task_id, turn, ts, model, tool, args (redacted),
result_summary, tokens_in, tokens_out, cost, latency_ms,
status, error_code, approver
\`\`\`\n\nStructured columns. SQL-queryable. With this, you can answer "why did this agent take 17 turns on Tuesday when the same task usually takes 4" in five minutes. Without it, you can't.\n\nAdd it on day one. Retrofitting observability into an agent that already runs is twice the work and half the value.`,
      },
      {
        heading: 'a worked example: a research agent',
        body:
`The shape of a small research agent:\n\n\`\`\`python
TOOLS = [search_web, fetch_url, extract_facts, store_note, query_notes, ask_human, done]
MAX_TURNS = 30
TOKEN_BUDGET = 200_000
WALL_TIME = 10 * 60  # seconds

def run_agent(goal: str):
    ctx = ContextBuffer()
    ctx.append_system(SYSTEM_PROMPT)
    ctx.append_user(f"Goal: {goal}\\nAvailable tools listed above.\\nCall \`done\` when complete.")
    for turn in range(MAX_TURNS):
        if ctx.tokens_used > TOKEN_BUDGET: return stop("budget")
        if time.time() - start > WALL_TIME: return stop("time")
        if ctx.loop_detected(): return stop("loop")

        resp = model.call(ctx, tools=TOOLS)
        log_step(task_id, turn, resp)

        if resp.tool == "done":
            return finish(resp.summary)
        if resp.tool == "ask_human":
            answer = wait_for_human(resp.question)
            ctx.append_tool_result(resp.tool, answer)
            continue

        try:
            result = call_tool(resp.tool, resp.args)
            ctx.append_tool_result(resp.tool, summarize(result))
        except RecoverableError as e:
            ctx.append_tool_result(resp.tool, {"ok": False, "hint": e.hint})
        except FatalError as e:
            return stop(f"fatal: {e}")

    return stop("max_turns")
\`\`\`\n\nThis is ~30 lines of orchestration around a model call. Nothing exotic. The interesting design is not in the code; it is in the choices: the tool list, the stop conditions, the structured error handling, the "done" tool, the explicit budgets.\n\nThe rest of the work — schema design, prompt tuning, observability, evals, sampling review — is what turns this skeleton into something you trust on a Tuesday morning.`,
      },
      {
        heading: 'where autonomy breaks',
        body: `Three failure modes that recur:\n\n- **the model commits to a confidently wrong plan.** It picks an approach in turn 1, marches through 8 turns, then hits a wall the plan didn't account for. The fix: add a "re-plan after N turns" checkpoint, or use an evaluator-optimizer loop on the plan itself.\n- **silent stalls.** The agent makes calls that succeed but don't advance the goal. Tool calls run, results come back, but nothing actually moves. The fix: a "what did this turn change about the world" check; if nothing changed for 2 turns, escalate or stop.\n- **the long-context drift.** After 20 turns, the original goal has drifted in the agent's working memory. The fix: pin the goal to the top of every context refresh; require the model to restate it before each significant action.\n\nNone of these are model problems. They are loop-design problems. The fixes are in the orchestration, not the prompt.`,
      },
      {
        heading: 'when to build an autonomous agent (and when not to)',
        body: `Autonomous agents earn their keep when:\n\n- the task is open-ended (research, debugging, multi-step planning)\n- the right sequence of steps depends on what the agent finds along the way\n- a human cannot pre-specify the path without writing a workflow that is mostly conditionals\n\nThey don't earn their keep when:\n\n- the workflow is known and stable — write the workflow\n- the task is one model call away from done — just call the model\n- the cost of a wrong action is high and the agent can take it autonomously — keep a human in the loop\n\nThe rule I keep: **default to a workflow. Reach for an autonomous agent only when the workflow you'd write is mostly branches and you'd rather have the agent decide.** Most production systems I admire are workflows with one or two truly autonomous steps inside.`,
      },
      {
        heading: 'the closer',
        body: `Autonomous agents are not magic. They are a particular software pattern — model + tools + environment + memory + explicit stops — with well-understood failure modes and a small set of operational practices that decide whether they work. Most of the engineering happens outside the prompt: in the tool surface, in the orchestration, in the observability, in the budgets.\n\nIf you internalise the four-part architecture and the stop-condition discipline, you can build an autonomous agent that holds up. If you don't, no model upgrade will rescue you.`,
      },
    ],
  },

  {
    slug: 'what-are-agentic-workflows',
    cover: '/blog/cover-agentic-workflows.png',
    title: 'What are agentic workflows? (and why most "agents" are actually workflows)',
    type: 'deep dive',
    date: 'May 17, 2026',
    readingTime: '12 min',
    color: 'paper-yellow',
    tags: ['agents', 'workflows', 'patterns'],
    excerpt:
      'Most production "agentic" systems are not agents. They are workflows with LLMs inside. Five patterns cover the vast majority — and they ship before agents do.',
    seoDescription:
      'A clear taxonomy of agentic workflows: prompt chaining, routing, parallelization, orchestrator-workers, and evaluator-optimizer. Why workflows ship before agents, and when each pattern is the right choice.',
    keywords: 'agentic workflows, prompt chaining, routing, parallelization, orchestrator workers, evaluator optimizer, Anthropic, LLM workflows',
    intro:
      `If you read the agent literature for an hour, you'd think production systems are open-ended autonomous loops solving novel problems. Then you look at what teams actually ship, and the reality is calmer. Most production "agentic" systems are **workflows** — orchestrated sequences of LLM calls with structured control flow between them. The model fills in the work; the workflow tells it what work to do, in what order, with what guardrails.\n\nThis distinction sounds pedantic. It is not. Workflows and agents have different operational profiles, different failure modes, different costs, and different debugging stories. Calling them all "agents" is how teams ship the wrong thing.`,
    sections: [
      {
        heading: 'the terminology problem',
        body: `Two definitions, in the form I find most useful:\n\n- **a workflow** is a system where LLM calls and tool calls happen in **predetermined paths**. The control flow is in your code. The model fills in the work.\n- **an agent** is a system where the LLM **directs its own actions and tool use** dynamically. The control flow is in the model. Your code provides the loop.\n\nMost systems sold as "agents" are workflows. That is not a criticism; workflows are usually the right answer. The criticism is the mislabel, because it sends teams into open-loop debugging when they have a closed-loop system.\n\nThe simple test: if you can draw the system as a directed graph where each node is "LLM does X" and each edge is fixed, it's a workflow. If the edges are decided by the model at runtime, it's an agent.`,
      },
      {
        heading: 'why workflows ship first',
        body: `Workflows ship first because they are predictable. You can:\n\n- write tests for each step\n- reason about cost (sum of per-step costs)\n- reason about latency (sum of per-step latencies)\n- debug a failure to a specific step\n- swap models per step (cheap model here, expensive model there)\n- evaluate each step independently\n\nAgents have none of these properties as cleanly. They are flexible at the cost of being harder to reason about. There is a time and place for that flexibility; it is later in the project, after the workflow has proven the basic shape works.\n\nThe pragmatic order: workflow first, agent only when the workflow you'd write is mostly conditionals and the open loop is doing the work the conditionals would have done.`,
      },
      {
        heading: 'the five patterns that cover almost everything',
        body:
`Five workflow patterns cover the vast majority of production "agentic" systems. Anthropic's research on "Building effective agents" frames these well; I'll keep the names and add field notes.\n\n![Five patterns, each with a distinct shape. Most production systems compose two or three of these.](/blog/diagram-workflow-patterns.svg)\n\nThe five:\n\n- **prompt chaining** — sequential LLM calls\n- **routing** — classifier picks a branch\n- **parallelization** — fan out, gather, aggregate\n- **orchestrator-workers** — an orchestrator delegates to specialists\n- **evaluator-optimizer** — generate, judge, revise\n\nThe next five sections walk each one, with when to use it, when not, and the failure mode it has.`,
      },
      {
        heading: 'prompt chaining',
        body: `**Shape.** Step A produces input for step B; step B produces input for step C. Each step is a model call.\n\n**Use it when.** A task decomposes cleanly into ordered sub-tasks. Outline → draft → polish. Extract → classify → format. Parse → validate → store.\n\n**Strengths.** Easy to reason about. Easy to add validation between steps ("the output of A must match this schema before B sees it"). Easy to swap models per step.\n\n**Failure mode.** Each step's errors propagate. A bad outline produces a bad draft no matter how good the polish step is. The fix is per-step evals plus a "gate" between steps that catches malformed output before the chain continues.\n\n**Practical tip.** Inject a deterministic validator between every two model calls. JSON schema check, regex check, length check. Catches 80% of cascading failures.`,
      },
      {
        heading: 'routing',
        body: `**Shape.** A classifier (often a small, fast model) categorises the input, then dispatches to a specialist handler. Each handler is itself a workflow.\n\n**Use it when.** Inputs vary in nature ("refund request" vs "technical question" vs "billing dispute"). Different handlers have different prompts, different tools, different models.\n\n**Strengths.** Each handler is simpler than a "one prompt fits all" approach. Easier to evaluate each branch independently. Cheaper — you don't pay for the most expensive model on the easiest inputs.\n\n**Failure mode.** The router misclassifies. Misclassification quietly degrades quality and is invisible until you sample by category and notice the wrong handler ran.\n\n**Practical tip.** Log the classification and the chosen branch. Run a weekly review: pick 20 random tasks, check whether the router picked the right branch. Misclassification is the leading cause of "the system mostly works but sometimes is weirdly bad."`,
      },
      {
        heading: 'parallelization',
        body: `**Shape.** Fan out independent sub-tasks; aggregate the results. Sometimes the fan-out is "the same task with different inputs" (process 100 documents in parallel); sometimes it's "different aspects of the same task" (summarise + extract entities + classify sentiment, in parallel, then combine).\n\n**Use it when.** Sub-tasks are independent. Latency matters and the work can be split. Multiple perspectives on the same input help (voting, ensembling).\n\n**Strengths.** Cuts latency proportionally. Naturally rate-limit-friendly (you control concurrency). Good fit for ensembling.\n\n**Failure mode.** Sub-tasks were not actually independent — one's output should have informed another's. The result is incoherent aggregation. Spot it by reading the final outputs side-by-side and asking "do these feel like they came from one mind?"\n\n**Practical tip.** Limit concurrency to your provider's rate limit minus a margin. Add a "joiner" model call at the end whose only job is to make the aggregated output coherent.`,
      },
      {
        heading: 'orchestrator-workers',
        body: `**Shape.** An orchestrator LLM decides what work needs doing and delegates to worker LLMs. The orchestrator owns the plan; workers do the focused tasks.\n\n**Use it when.** Tasks decompose dynamically — you don't know the sub-tasks until the orchestrator has looked at the input. Different sub-tasks need different specialists.\n\n**Strengths.** Combines the predictability of a workflow with some flexibility on what gets done. Workers can be specialised (different prompts, different tools).\n\n**Failure mode.** The orchestrator under-decomposes (one giant sub-task that should have been three) or over-decomposes (ten tiny sub-tasks that should have been two). Both quietly degrade quality.\n\n**Practical tip.** Constrain the orchestrator to produce a structured plan **first**, then execute. Review the plan in eval samples — most orchestration failures show up at the plan stage, not the execution stage.`,
      },
      {
        heading: 'evaluator-optimizer',
        body: `**Shape.** A generator produces a candidate output. An evaluator judges it against a rubric. If acceptable, ship. If not, the generator revises, possibly with the evaluator's feedback. Loop until accepted or budget exhausted.\n\n**Use it when.** Quality matters and you have a clear rubric. Iterative refinement helps. The cost of one extra round is much smaller than the cost of shipping a worse output.\n\n**Strengths.** Genuinely improves quality on tasks with clear standards — translation, code, structured outputs, formatting-sensitive content. The judge can be a cheaper model than the generator.\n\n**Failure mode.** The judge agrees with the generator too easily (same-model bias). The loop never converges and burns budget. The rubric is too vague to be useful.\n\n**Practical tip.** Use a different model family for the judge than the generator. Cap rounds at 3. Log the judge's verdicts on a sample weekly — if it almost always says "ship," your rubric is too loose.`,
      },
      {
        heading: 'when to use a workflow vs an agent',
        body: `A short decision rule:\n\n- if you can write the steps down, write a workflow\n- if you can mostly write the steps down with a few conditionals, write a workflow with routing\n- if the steps depend on what you find along the way and you'd be writing dozens of conditionals, consider an agent\n- if the cost of a wrong step is high, write a workflow (predictable failure modes)\n- if the cost of being slow is high, write a workflow (fewer round trips)\n- if you don't have evals yet, write a workflow (easier to evaluate per-step)\n\nThe migration path is: ship a workflow, run it, find the parts that are 80% conditionals, replace those with an open-loop agent. Don't start with the agent; you'll end up rebuilding the workflow inside the agent and losing the operational benefits.`,
      },
      {
        heading: 'composing the patterns',
        body: `Real production systems compose. A typical shape:\n\n\`\`\`
user request
  → router (small model, classify intent)
    → branch A: prompt chain (extract → validate → format)
    → branch B: orchestrator-workers (plan, then parallel workers)
    → branch C: evaluator-optimizer (draft, judge, revise)
      → final answer (with optional human-in-the-loop)
\`\`\`\n\nThree of the five patterns, working together. Each one named, each one debuggable, each one swappable. This is what "production agentic" usually looks like. Not a single open loop; a composition of patterns, each chosen for the part of the job it does well.`,
      },
      {
        heading: 'the closer',
        body: `If the word "agent" got you here, you can leave with two ideas. First: most things called agents are workflows, and that is usually the right answer. Second: workflows have a small, well-understood pattern language — chain, route, parallelize, orchestrate, evaluate — that covers the vast majority of useful systems.\n\nLearn the patterns. Compose them. Reach for an autonomous agent only when the workflow you'd write is mostly conditionals. Most days, it isn't.`,
      },
    ],
  },

  {
    slug: 'what-are-agents',
    cover: '/blog/cover-what-are-agents.png',
    title: 'What are agents? (without the marketing)',
    type: 'deep dive',
    date: 'May 17, 2026',
    readingTime: '11 min',
    color: 'paper-blue',
    tags: ['agents', 'fundamentals', 'llm'],
    excerpt:
      'A model, some tools, and a loop. Strip away the buzzwords and that\'s most of it. The interesting parts are everywhere else.',
    seoDescription:
      'A grounded explanation of what AI agents are — model + tools + loop — with the minimal architecture, what an agent is not, and the small set of properties that make one useful in production.',
    keywords: 'AI agents, what is an agent, agent loop, LLM agents, tool use, ReAct, autonomous agents, agent definition',
    intro:
      `If you ask twelve engineers what an "agent" is, you get fourteen answers. Most of them are right; some of them disagree with each other; none of them are wrong enough to argue about. The word "agent" is doing too much work in 2026.\n\nHere is the definition I keep coming back to, after building a few of these in production: **an agent is a model that can take actions in a loop until it decides it is done.** That's it. A model, some tools, a loop, and a stop condition. Everything else — planning, memory, sub-agents, reflection, frameworks with three-letter acronyms — is a refinement of that skeleton, not a replacement for it.`,
    sections: [
      {
        heading: 'the minimal definition',
        body:
`Three components and one property:\n\n- a **model** that can reason about the next step\n- a set of **tools** the model can call to act on the world\n- a **loop** that keeps running until a stop condition trips\n\nAnd one property: the model — not your code — chooses the next action each turn.\n\n![Five boxes: ask, decide, act, observe, done. The agent is the loop back.](/blog/diagram-agent-loop.svg)\n\nA one-shot LLM call stops at "decide." An agent is what happens when "decide" can produce a tool call, the tool runs, the result goes back to the model, and the model decides again. The loop is the agency.`,
      },
      {
        heading: 'what an agent is not',
        body: `Three things that get called agents and shouldn't be:\n\n- **a one-shot LLM call with retries.** A model call, however clever, is not an agent. No tools, no loop, no choice of next action.\n- **a RAG system.** RAG is "retrieve, then generate." There is a step. There is not a model deciding what to do next. RAG can be a component of an agent, but RAG alone is not an agent.\n- **a workflow with LLM calls in it.** If your code controls the sequence and the LLM just fills in the work, you have a workflow. Workflows are often the right answer — see [What are agentic workflows?](/writing/what-are-agentic-workflows) — but they are a different shape than agents, and conflating them muddles every conversation about what to ship.\n\nThe simple test: at the next step, who decides what happens? If it's the model, you have an agent. If it's your code, you have a workflow. Both are useful. They are not the same.`,
      },
      {
        heading: 'the agent loop, in roughly 30 lines',
        body: `Stripped to the bones, the loop is unimpressive:\n\n\`\`\`python
def run_agent(goal, tools, model, max_turns=20):
    history = [system_prompt(tools), user(f"Goal: {goal}")]
    for turn in range(max_turns):
        resp = model.call(history, tools=tools)
        history.append(assistant(resp))
        if resp.tool_calls:
            for call in resp.tool_calls:
                result = tools[call.name].run(**call.args)
                history.append(tool_result(call, result))
        else:
            return resp.text  # model didn't call a tool; done
    raise BudgetExceeded("max turns reached")
\`\`\`\n\nThis is ~15 lines of orchestration. It runs. It is also brittle, and the brittleness is where the engineering lives. There is no error handling, no observability, no loop detection, no explicit "done" tool, no budget for tokens or wall time, no recovery from malformed tool calls. Adding each of those is a small, sensible step. Doing them well is the difference between a demo and a production system.\n\nMost of the interesting work in agents is in those next 200 lines, not in this 15.`,
      },
      {
        heading: 'what gives an agent its agency',
        body: `Three properties an agent has that a workflow doesn't:\n\n- **the action space is the model's choice.** At each turn, the model picks from a set of tools. Different turns can pick different tools, in different orders, depending on what the agent has observed so far.\n- **the loop is open-ended.** There is no fixed sequence. The number of turns depends on what the agent finds and decides.\n- **the stop is decided, not pre-coded.** The agent declares "done" (or hits a budget). Your code doesn't say "stop after step 3."\n\nThese three together produce flexibility. They also produce the operational difficulty: an open-ended loop has more failure modes than a closed sequence. The trade-off is real, and it is why workflows ship first in most teams.`,
      },
      {
        heading: 'three properties of useful agents',
        body: `Not every system that fits the definition is useful. The agents that work in practice share three properties:\n\n- **bounded.** Explicit stop conditions — budget, turn limit, loop detection, "done" tool, "ask human" tool. Unbounded agents are processes that surprise you.\n- **observable.** Every step logged. Every tool call recorded. Every decision traceable. You should be able to answer "why did the agent do that on turn 7" in two minutes.\n- **recoverable.** Tools return structured errors with hints. The model can retry intelligently. The state of the world is consistent whether the agent ran one turn or fifteen.\n\nA flexible, unbounded, unobservable agent is not an agent. It is a process you'll eventually shut down by killing the process.`,
      },
      {
        heading: 'common misunderstandings',
        body: `A few I run into often:\n\n- **"agents need planning."** They benefit from it for complex tasks. They don't require it. Simple agents can work without an explicit plan; complex agents almost always plan poorly without one. Choose based on the task.\n- **"agents need memory."** They need memory if the task spans long enough that the context can't hold it all. Otherwise context is enough. Most agents that "added a vector store for memory" didn't need to.\n- **"agents need to be autonomous."** Autonomy is a spectrum. The most useful agents in my experience are mostly bounded with one or two open-ended steps. Full autonomy is rarely the goal; flexibility within constraints is.\n- **"agents need a framework."** Frameworks help; they also obscure. The skeleton above is 15 lines of code. If you can't write that without a framework, you don't yet understand the system you're shipping.`,
      },
      {
        heading: 'a 60-line agent that does something real',
        body: `Here's an agent that reads code and explains a function:\n\n\`\`\`python
TOOLS = {
    "read_file": lambda path: open(path).read(),
    "list_files": lambda dir: os.listdir(dir),
    "grep": lambda pattern, path: subprocess.run(["rg", pattern, path], capture_output=True).stdout.decode(),
    "done": lambda explanation: explanation,
}

SYSTEM = """You are a code-reading assistant. Given a function name and a repo,
find the function, read it, understand it, and call \`done\` with a clear explanation.
- use \`list_files\` and \`grep\` to find the file
- use \`read_file\` to read it
- if the function calls other functions, read those too if needed
- call \`done\` when you have a confident explanation
"""

def run(goal: str, max_turns=15, token_budget=80_000):
    history = [{"role": "system", "content": SYSTEM},
               {"role": "user", "content": goal}]
    tokens_used = 0
    for turn in range(max_turns):
        if tokens_used > token_budget: return "STOP: budget"
        resp = model.create(model="claude-sonnet-4-6",
                            messages=history,
                            tools=TOOL_SCHEMAS)
        tokens_used += resp.usage.input_tokens + resp.usage.output_tokens
        history.append({"role": "assistant", "content": resp.content})
        for block in resp.content:
            if block.type == "tool_use":
                if block.name == "done":
                    return block.input["explanation"]
                try:
                    result = TOOLS[block.name](**block.input)
                except Exception as e:
                    result = {"ok": False, "error": str(e), "hint": "check the tool args"}
                history.append({"role": "user", "content": [
                    {"type": "tool_result", "tool_use_id": block.id,
                     "content": str(result)[:4000]}  # trim long results
                ]})
    return "STOP: max_turns"
\`\`\`\n\nNot production-ready. No structured logging, no loop detection, no fancy error handling. But it's a real agent. It uses tools. It loops. The model decides the next action. It has stop conditions. That is the whole shape.`,
      },
      {
        heading: 'where agents live on the autonomy spectrum',
        body: `Agents are not "autonomous" or "not autonomous." They sit on a spectrum:\n\n- **rung 1.** Every action approved by a human. Very safe, very slow.\n- **rung 2.** Read-only tools auto; writes need approval. Most production agents start here.\n- **rung 3.** Writes auto within a sandbox; cross-boundary actions need approval.\n- **rung 4.** Mostly auto, with checkpoints at major transitions. Approval is the exception.\n- **rung 5.** Fully autonomous within configured budgets. Reviewed after the fact, not before.\n\nMost useful agents in 2026 sit at rung 2 or 3. Rung 5 systems exist in narrow, well-bounded domains. Anyone shipping a rung-5 agent on day one is shipping a story they'll tell at industry meetups.`,
      },
      {
        heading: 'the closer',
        body: `Strip the marketing and the picture stays simple. An agent is a model with tools, a loop, and a stop condition. That is the whole skeleton. Everything else — planning, memory, sub-agents, reflection, reranking, the cleverest framework on the market — is operational craft layered on top.\n\nThe craft matters. It is the part that turns a 30-line agent loop into a system you trust at 3am. But it is craft, not magic. Once the skeleton is clear, the rest is engineering. The next posts walk that engineering: [workflows](/writing/what-are-agentic-workflows), [autonomous agents](/writing/what-are-autonomous-agents-and-how-to-build-them), and the [ten habits](/writing/10-things-to-ensure-you-are-building-agents-right) that decide whether what you ship holds up.`,
      },
    ],
  },

  {
    slug: 'hybrid-retrieval-and-rerankers',
    cover: '/blog/cover-hybrid-retrieval.png',
    title: 'Hybrid retrieval and rerankers: how to actually win at retrieval',
    type: 'deep dive',
    date: 'May 16, 2026',
    readingTime: '14 min',
    color: 'paper-blue',
    tags: ['rag', 'retrieval', 'bm25', 'reranker'],
    excerpt:
      'One retriever is never enough. BM25 + dense embeddings + RRF + a cross-encoder reranker — the full stack, with numbers.',
    seoDescription:
      'Why hybrid retrieval beats any single retriever, how Reciprocal Rank Fusion works, when a cross-encoder reranker is worth its latency, and how to measure retrieval honestly with recall@k, MRR, and nDCG.',
    keywords: 'hybrid retrieval, BM25, dense retrieval, reciprocal rank fusion, RRF, cross-encoder reranker, retrieval evaluation, recall, MRR, nDCG, RAG',
    intro:
      `Most teams plug in a vector database, look at top-5 results that look "kinda right," and call retrieval solved. Then they spend the next six months debugging why the model "ignores the context," which is rarely what's actually happening. The context never had the right chunks to begin with.\n\nThe single biggest lever in RAG quality, after chunking, is retrieval design. And the single most reliable retrieval design is not "a better embedding model." It is a stack: lexical recall, semantic recall, fused ranking, and a second-stage reranker. Each piece does a different job. Most teams ship the first one and stop.`,
    sections: [
      {
        heading: 'one retriever is never enough',
        body: `BM25 is good at exact matches — product names, error codes, function names, identifiers, jargon, anything that has a precise lexical form. It is terrible at synonyms and paraphrasing. Ask "how do I roll back" when the doc says "revert," and BM25 misses.\n\nDense embeddings are good at meaning. "roll back" and "revert" sit near each other in vector space. Ask for a "P95 latency dashboard" when the doc talks about "tail latency monitoring," and dense retrieval finds it. Dense is terrible at exact identifiers — \`ERR_CONN_REFUSED\` and \`ERR_CONN_RESET\` are basically the same vector, and that's the wrong answer.\n\nThese are not the same failure mode, and they don't degrade gracefully together. The fix is to run both, and combine the rankings.`,
      },
      {
        heading: 'BM25, in two paragraphs',
        body: `BM25 is the modern descendant of TF-IDF, used by Elasticsearch / OpenSearch / Lucene / Tantivy / Vespa / pretty much every keyword search engine since 1994. It scores a document for a query as:\n\n\`\`\`
score(d, q) = Σ IDF(qᵢ) · (tf(qᵢ, d) · (k₁ + 1)) / (tf(qᵢ, d) + k₁ · (1 - b + b · |d|/avgdl))
\`\`\`\n\nYou don't need to memorise this. You need to remember two things. First: BM25 has a saturation curve — the 50th occurrence of a term in a doc adds almost nothing over the 10th. Second: BM25 normalises for document length, so long docs don't trivially win.\n\nTune knobs (\`k₁ ≈ 1.2\`, \`b ≈ 0.75\`) once and forget. The defaults are good. The real gains are in tokenization (stem? lowercase? handle code identifiers?) and field weighting (boost titles 2-3x over body). Spend an afternoon there.`,
      },
      {
        heading: 'dense embeddings, in a few honest paragraphs',
        body: `Dense retrieval is: turn each chunk into a vector (typically 384-3072 dimensions), turn the query into a vector with the same encoder, find the nearest chunks by cosine similarity. The "find the nearest" part uses an approximate nearest-neighbour index — HNSW, IVF-PQ, ScaNN, or Voyager — because exact search at scale is too slow.\n\nA few practical realities:\n\n- **Model choice matters more than dimension count.** A 768-dim model from a strong family will beat a 3072-dim model from a weaker one. Pick by quality on your domain, not by dimension.\n- **Reindex on every model change.** Your old embeddings are not comparable to new embeddings. There is no fix for this; it is a property of the geometry.\n- **Normalise your vectors** if your index expects unit-length (most do). Cosine similarity and dot product are the same on unit vectors; only one of those is fast in most indexes.\n- **Ask the encoder how it wants the input.** Some models expect "query: …" / "passage: …" prefixes. If you skip the prefix on one side and not the other, your recall drops 10-15% and you have no idea why.\n\nDense alone is a strong baseline. It is also a single point of failure. The next section is why.`,
      },
      {
        heading: 'fusing the two: Reciprocal Rank Fusion',
        body:
`The simplest way to combine two rankings — without training anything, without learning weights — is Reciprocal Rank Fusion (RRF). For each document, sum \`1 / (k + rank)\` across the retrievers that returned it. The constant \`k\` is usually 60. That's it. That's the whole algorithm.\n\n![Two rankings, one fused list. The docs that appear in both bubble to the top without any tuning.](/blog/diagram-rrf-fusion.svg)\n\nWhy RRF works:\n\n- documents that appear in **both** rankings score above documents that appear in only one\n- the \`k=60\` constant **dampens** the gap between rank 1 and rank 2; you don't over-trust the top of either list\n- there are no learned weights to tune, drift, or version\n- it is trivially fast — a hashmap and a sort\n\nA tiny implementation:\n\n\`\`\`python
from collections import defaultdict

def rrf(rankings: list[list[str]], k: int = 60, topn: int = 50) -> list[str]:
    scores = defaultdict(float)
    for ranking in rankings:
        for rank, doc_id in enumerate(ranking, start=1):
            scores[doc_id] += 1.0 / (k + rank)
    return sorted(scores, key=scores.get, reverse=True)[:topn]
\`\`\`\n\nUse it. It works. The two-page paper that proposed it (Cormack et al., 2009) has held up because it captures a real property: a document that two different retrievers independently surface is more likely to be relevant than a document only one of them found. RRF is the cheap way to use that signal.`,
      },
      {
        heading: 'when to reach for a learned fusion model',
        body: `RRF is good enough almost always. The cases where it isn't:\n\n- you have a strong learned ranker (e.g., a fine-tuned cross-encoder) and you want to use its scores directly\n- you have a labelled dataset large enough to train a linear blend (a few thousand judgements minimum)\n- one of your retrievers is reliably weaker, and you want to down-weight it\n\nFor the first case, just skip fusion and put the cross-encoder on top (next section). For the second, normalise scores per-retriever (z-score or min-max), then learn a weighted sum on held-out data. For the third, RRF already handles it gracefully — a weak retriever surfaces fewer of the right docs, so those docs get only a small contribution.\n\nIn 90% of production setups: stop at RRF.`,
      },
      {
        heading: 'rerankers: the second-stage sort that earns its latency',
        body: `A reranker is a model that takes the query and a candidate doc, **looks at them together**, and produces a relevance score. Unlike retrievers, which encode query and docs separately and compare in vector space, a reranker reads both as one input. This is called a **cross-encoder**.\n\nCross-encoders are slow. You cannot run one over a million documents. You can run one over 50-100. Which is exactly what the previous stage gives you.\n\nThe full stack:\n\n- retrieve top-100 from BM25\n- retrieve top-100 from dense\n- fuse with RRF → top-50\n- rerank with a cross-encoder → top-5 or top-10\n- send those to the model\n\nA well-chosen reranker (BGE-reranker, Cohere Rerank, ColBERT-v2, or a fine-tuned variant for your domain) typically moves recall@5 up by 4-15 points over fused retrieval alone, with a 50-200ms cost. On most workloads, that latency is worth it. On chat workloads where every second matters, it sometimes isn't. Measure it.`,
      },
      {
        heading: 'measuring retrieval honestly',
        body: `If you only measure end-to-end answer quality, you can't tell whether retrieval, reranking, or generation is the bottleneck. Three retrieval-specific metrics, in order of how often I reach for them:\n\n- **recall@k.** Of the queries whose answer lives somewhere in your index, how many have at least one relevant doc in the top-k? Easy to compute, the most important number, the one that catches "the answer isn't even in the candidate set."\n- **MRR (Mean Reciprocal Rank).** For each query, take \`1 / (rank of first relevant doc)\`; average across queries. Captures how high the first good doc lands.\n- **nDCG@k (Normalized Discounted Cumulative Gain).** Like MRR but accounts for multiple relevance levels (highly relevant > somewhat relevant > irrelevant). Necessary when your judgements are graded, not binary.\n\nYou need labelled data to compute any of these. Most teams skip this and pay for it later. The cheap version: pick 50-100 representative queries, hand-label which docs in the corpus are relevant for each, freeze it, and run your retriever against the labels weekly.\n\nIf labelling 100 queries sounds expensive, your retrieval problem is not your top priority anyway.`,
      },
      {
        heading: 'diversity: stop sending the model five copies of the same chunk',
        body: `One under-discussed retrieval failure: the top-k looks great on recall but the model still flounders, because chunks 1-5 are near-duplicates. The model gets one perspective five times instead of five perspectives.\n\nThe fix is **Maximum Marginal Relevance (MMR)**: at each step, pick the next doc that maximises a blend of (relevance to query) and (dissimilarity from already-picked docs). It's a one-liner over an inner loop, and it makes top-k far more useful for generation.\n\n\`\`\`
choose doc d that maximises: λ · rel(q, d) - (1-λ) · max(sim(d, d') for d' in chosen)
\`\`\`\n\nλ = 0.7 is a sensible default. Run MMR after reranking, not before — you want to diversify high-relevance candidates, not lose them.`,
      },
      {
        heading: 'when to skip a stage',
        body: `- **skip BM25** if your corpus has no identifiers, function names, or precise jargon — pure prose, semantic-only domain\n- **skip dense** if your corpus is small (< 10k docs) and your users always type queries that match the doc language — BM25 alone can be enough\n- **skip RRF** if you only have one retriever; you already have a ranking\n- **skip the reranker** if your latency budget is sub-300ms and your fused recall@5 is already > 90%\n- **skip MMR** if your chunks are large and naturally diverse (less common than people think)\n\nNothing is mandatory. Everything is a trade-off. The point is to know which trade-off you're making.`,
      },
      {
        heading: 'a realistic stack, with numbers',
        body: `Numbers from a corpus I work with (~1.2M docs, technical content with identifiers and prose):\n\n- BM25 alone: recall@10 = 71%, p50 latency = 18ms\n- Dense alone (768-dim, HNSW): recall@10 = 78%, p50 latency = 24ms\n- BM25 + dense + RRF: recall@10 = 86%, p50 latency = 35ms\n- BM25 + dense + RRF + cross-encoder rerank (top-50 → top-10): recall@10 = 93%, p50 latency = 140ms\n\nThe reranker delivers most of the final gain. RRF is the cheapest 8 points of recall you will ever buy. Dense alone is fine for a Monday demo. Nothing alone gets above 80% on this kind of corpus.\n\nYour numbers will differ. The shape — that each stage adds non-overlapping recall, with diminishing returns — usually does not.`,
      },
      {
        heading: 'the boring closer',
        body: `Retrieval is the part of RAG with the highest ratio of "obvious in retrospect" to "actually shipped." The hard part is committing to measuring it. Once you have honest recall@k numbers on a fixed eval set, every other decision — should I switch embedding models, should I add a reranker, should I tweak my chunking — becomes a small, evidence-backed experiment instead of a vibes argument in a planning meeting.\n\nIf you take one thing from this post: instrument retrieval as its own product, separate from generation. Treat it like search. Because that's what it is.`,
      },
    ],
  },

  {
    slug: 'chunking-the-most-ignored-knob-in-rag',
    cover: '/blog/cover-rag-chunking.png',
    title: 'Chunking, the most-ignored knob in RAG',
    type: 'deep dive',
    date: 'May 15, 2026',
    readingTime: '13 min',
    color: 'paper-yellow',
    tags: ['rag', 'chunking', 'retrieval'],
    excerpt:
      'Most RAG teams accept the default 1000-token chunks and never look back. The single biggest jump in retrieval quality I have ever shipped came from looking back.',
    seoDescription:
      'A deep look at chunking strategies for RAG: fixed-size, overlap, sentence-window, semantic, parent-child, and late chunking — with trade-offs and real-workload numbers.',
    keywords: 'RAG chunking, chunk size, semantic chunking, sentence window, parent-child, late chunking, recursive splitter, retrieval, document splitting',
    intro:
      `Chunking is the layer of RAG with the loudest "we'll deal with it later" energy and the largest hidden quality lift. You inherit a default — 1000 tokens with 200 overlap, usually — from a tutorial, and you ship. Six months later, retrieval is "fine" and answers are "kinda right." The system has been hobbled since day one and nobody has questioned the chunks.\n\nThe most embarrassing-in-hindsight retrieval gain I have ever shipped came from changing nothing except the chunking. Same embeddings. Same retriever. Same model. Same prompts. Just better chunks. Recall@5 went from 71% to 86%. The lesson stuck.`,
    sections: [
      {
        heading: 'why chunking is where most teams lose',
        body: `Three properties of chunks decide most of your retrieval quality:\n\n- **Size.** A chunk too small can't carry enough context to answer anything; a chunk too large dilutes its own embedding and recalls badly.\n- **Boundary.** Where you cut decides whether the answer is mid-sentence with no antecedent ("it depends on the previous value") or self-contained.\n- **Granularity vs context trade-off.** Small chunks retrieve precisely but lack context; large chunks have context but match imprecisely. The classic resolution is to embed small and return large.\n\nThe defaults you start with rarely satisfy all three. Worse, you can't tell from end-to-end answer quality whether chunking is the problem. You have to look at retrieval directly.`,
      },
      {
        heading: 'fixed-size: cheap, predictable, underrated',
        body:
`Fixed-size chunking splits the text into N-token windows. Maybe with overlap. That's it.\n\n![Five strategies, same document. The boundaries determine what your retriever can ever find.](/blog/diagram-chunk-strategies.svg)\n\nIt sounds primitive because it is. It also has properties the fancier strategies don't always have: predictable embedding cost, predictable index size, deterministic boundaries, easy to debug. On many corpora, fixed-size is within a few points of any "smarter" strategy and far easier to operate.\n\nThe two knobs:\n\n- **size.** 256-1024 tokens is the practical range. Smaller for QA over technical docs, larger for narrative content. Match it to the typical answer span. If most answers are 1-2 sentences, 256-512 wins. If most answers need a paragraph of surrounding logic, 768-1024.\n- **overlap.** 10-20% is the sweet spot. Less than 10%, you start losing answers that straddle boundaries. More than 20%, you mostly inflate your index for diminishing returns.\n\nIf you're starting a new RAG system today and don't have time to experiment, start with **fixed-size 512 tokens, 64 token overlap, split on sentence boundaries within the window**. You can ship that on Monday and it won't embarrass you.`,
      },
      {
        heading: 'recursive character splitting (the workhorse)',
        body: `What most production systems actually run is fixed-size with **boundary preference**. The splitter tries to break at paragraph boundaries first, falls back to sentence boundaries, then to whitespace, then to characters — whichever lands closest to the target size without exceeding it.\n\nLangChain's RecursiveCharacterTextSplitter, LlamaIndex's SentenceSplitter, and most homegrown chunkers implement some version of this. The implementation is short:\n\n\`\`\`python
SEPARATORS = ["\\n\\n", "\\n", ". ", " ", ""]

def recursive_split(text: str, target: int, overlap: int, seps=SEPARATORS) -> list[str]:
    if len(text) <= target:
        return [text]
    sep = seps[0]
    parts = text.split(sep) if sep else list(text)
    out, cur = [], ""
    for p in parts:
        candidate = (cur + sep + p) if cur else p
        if len(candidate) <= target:
            cur = candidate
        else:
            if cur:
                out.append(cur)
            if len(p) > target:
                out.extend(recursive_split(p, target, overlap, seps[1:]))
                cur = ""
            else:
                cur = p
    if cur:
        out.append(cur)
    if overlap:
        out = _apply_overlap(out, overlap)
    return out
\`\`\`\n\nIt is not glamorous. It is the right default for 80% of corpora.`,
      },
      {
        heading: 'sentence-window: small for retrieval, big for context',
        body: `Sentence-window chunking embeds **one sentence** per chunk, but on retrieval returns a window of N sentences around the matched sentence. So your retriever is matching at sentence granularity (precise) but the model sees a small paragraph (context).\n\nThis is the technique that punched well above its weight in my experience for QA-style RAG. It is dead simple, it is well-suited to documents where answers are localised to a sentence or two, and it solves the "tiny chunks retrieve great but lose context" problem directly.\n\nThe data shape:\n\n\`\`\`
chunk_0: { embed_text: "sentence_5", parent_text: "sentence_3 ... sentence_7" }
chunk_1: { embed_text: "sentence_6", parent_text: "sentence_4 ... sentence_8" }
\`\`\`\n\nYou embed only \`embed_text\`. You return \`parent_text\` to the model. Storage cost roughly doubles; retrieval quality on QA workloads typically moves 5-15 points.`,
      },
      {
        heading: 'semantic chunking: split where the topic shifts',
        body: `Semantic chunking splits text based on **embedding distance between consecutive sentences**. Compute the embedding of each sentence; when the cosine distance between sentence i and sentence i+1 exceeds a threshold, draw a chunk boundary there.\n\nThe result: chunks of variable size, but each chunk holds a single topical unit.\n\nWhen it shines:\n\n- documents with clear topical transitions (long-form articles, mixed-topic pages, transcripts)\n- corpora where fixed-size frequently splits the answer span\n\nWhen it disappoints:\n\n- documents that are already well-structured (good headings, short sections — fixed-size + heading-respect does just as well)\n- highly technical content where consecutive sentences have low cosine distance even when they discuss different things (the threshold is hard to tune)\n- giant compute cost: you need to embed every sentence just to chunk, before you embed for retrieval\n\nIt is a real technique with real wins. It is also frequently chosen because it sounds smart, on workloads where simpler chunking would have done the same job for a tenth of the engineering effort.`,
      },
      {
        heading: 'parent-child (hierarchical): the best general default',
        body: `Parent-child chunking is the natural extension of sentence-window. You define two granularities:\n\n- **child chunks.** Small (128-256 tokens). The thing you embed and retrieve against.\n- **parent chunks.** Large (1024-2048 tokens). The thing you return to the model. Each child knows which parent it belongs to.\n\nOn retrieval, you find the best children, then deduplicate by parent (often multiple top children belong to the same parent) and return parents. The model gets coherent, surrounded context. The retriever still matches at small granularity.\n\nThis is the strongest "general" chunking strategy I know — works well across most domains, is straightforward to implement, and pairs cleanly with reranking (rerank at child granularity, return parents).\n\nA short implementation:\n\n\`\`\`python
def build_parent_child(text, parent_size=1024, child_size=256, overlap=32):
    parents = recursive_split(text, parent_size, 0)
    items = []
    for pi, p in enumerate(parents):
        children = recursive_split(p, child_size, overlap)
        for c in children:
            items.append({"text": c, "parent_id": pi, "parent_text": p})
    return items

def retrieve_parents(query, items, top_k_children=20, top_parents=5):
    children = nearest_children(query, items, k=top_k_children)
    seen, parents = set(), []
    for c in children:
        if c["parent_id"] not in seen:
            seen.add(c["parent_id"])
            parents.append(c["parent_text"])
        if len(parents) == top_parents:
            break
    return parents
\`\`\`\n\nIt is more storage, but the retrieval gains are usually unambiguous.`,
      },
      {
        heading: 'late chunking: a newer trick worth knowing',
        body: `Late chunking is a 2024-ish technique that changes the order of operations. Normally you chunk first, then embed. Late chunking does the opposite: embed the whole document (or a long window) with a long-context encoder, then chunk the resulting token-level embeddings and pool each chunk to produce its representation.\n\nThe idea: each chunk's embedding now reflects the document's full context, not just the words inside the chunk. A chunk that says "the threshold should be 12" now embeds with knowledge that "the threshold" refers to risk score, because the encoder saw the preceding context.\n\nReality check:\n\n- requires a long-context encoder (Jina v3, BGE-M3, others)\n- compute is higher (you encode the full doc, even if you only retrieve a few chunks)\n- the gain on most workloads is real but modest (1-4 points recall@10)\n- great for documents where coreference is heavy ("it," "this," "the above")\n\nWorth experimenting with on coreference-heavy corpora. Not worth ripping out fixed-size for, if your retrieval is already at 90%+ recall@5.`,
      },
      {
        heading: 'respecting document structure (the thing nobody mentions)',
        body: `Almost no chunker out of the box respects:\n\n- markdown headings (level 1 vs 2 vs 3)\n- code blocks (which should never be split)\n- tables (which lose meaning when split)\n- list items (which should usually stay together)\n- footnotes / citations\n\nThe single highest-ROI chunker improvement I have ever made was a 50-line wrapper that: split on heading boundaries first, refused to split inside code blocks, kept whole tables together, and prefixed each chunk with the heading path it came from ("Auth > Tokens > Rotation"). Retrieval got noticeably better. Nobody on the team had to learn any new theory.\n\nThis kind of structure-aware chunking is unglamorous and underdiscussed. It is also where most production wins live.`,
      },
      {
        heading: 'what to measure',
        body: `Two evaluations, separate from end-to-end answer quality:\n\n- **chunk recall@k.** Of the queries whose answer span is in the corpus, how many have a chunk containing the span in the top-k? This isolates "did we find the right chunk?"\n- **answer reconstructability.** Given the top-k chunks, can a human (or a strong model) reconstruct the answer? If not, you might be retrieving fine but cutting the answer in half. Common when chunks are too small or there is no overlap.\n\nThese two together diagnose 90% of chunking issues. If recall is high but reconstructability is low: your chunks are too small or you need a parent-child setup. If recall is low: your chunks are mis-bounded, or your embedding strategy doesn't suit your content.`,
      },
      {
        heading: 'a short checklist',
        body: `- start with fixed-size (512 tokens, 10% overlap, respect sentence boundaries)\n- respect document structure: don't split inside code, tables, or list items\n- prefix each chunk with its heading path\n- if QA quality is uneven, try sentence-window\n- if context is missing, try parent-child\n- if topics shift unpredictably, consider semantic chunking\n- only consider late chunking if coreference is killing you and you already have long-context encoders\n- measure chunk recall@k separately from end-to-end quality\n\nNone of this is exotic. All of it is what teams shipping good RAG actually do.`,
      },
      {
        heading: 'the boring closer',
        body: `Chunking is engineering, not research. There is no breakthrough hiding in a paper. There is just a series of small, sensible decisions about size, boundary, granularity, and structure — and a willingness to measure your own choices.\n\nThe teams that ship great RAG treat chunking like a first-class part of the system. The ones that don't are still arguing about embedding models a year later, wondering why nothing helped.`,
      },
    ],
  },

  {
    slug: 'rag-isnt-a-thing-its-a-pipeline',
    cover: '/blog/cover-rag-anatomy.png',
    title: "RAG isn't a thing, it's a pipeline",
    type: 'deep dive',
    date: 'May 14, 2026',
    readingTime: '14 min',
    color: 'paper-coral',
    tags: ['rag', 'pipeline', 'systems'],
    excerpt:
      'Six stages, each with its own failure modes. A close look at what production RAG actually contains, and how to tell which stage is hurting you.',
    seoDescription:
      'A deep, stage-by-stage look at production RAG systems: ingest, parse, chunk, embed, retrieve, generate. Where each stage fails, how to diagnose it, and why pipeline evals beat end-to-end evals.',
    keywords: 'RAG pipeline, retrieval augmented generation, ingest, parse, chunk, embed, retrieve, generation, RAG architecture, RAG evaluation, RAG failures',
    intro:
      `"Our RAG isn't working" is one of those sentences that sounds like a problem statement and is actually a question waiting to happen. There is no such object as RAG. There is a pipeline of six (sometimes seven) stages, and at any given moment one of them is hurting you. The skill is in figuring out which.\n\nThis post walks the full pipeline, end to end, with the failure modes that actually show up in production. It is the post I wish I had when I started building this stuff, in place of the dozen blog posts that each treated their favourite stage as the whole job.`,
    sections: [
      {
        heading: 'RAG is not a model. it is a pipeline.',
        body: `Think of RAG as a UNIX pipe with six stages:\n\n\`\`\`
ingest → parse → chunk → embed → retrieve → generate
\`\`\`\n\nEach stage takes input from the previous one and produces output for the next. Each stage has its own failure modes. None of them are visible in end-to-end answer quality unless you instrument them separately.\n\nThe single most useful framing I can give you: when an answer is wrong, the question is not "is RAG broken." It is "which stage is broken." Six possible diagnoses. Different fixes for each. End-to-end "answer quality went up" tells you nothing about which.`,
      },
      {
        heading: 'stage 1: ingest',
        body: `Ingest is the part everyone underestimates because it sounds boring. It is: get documents from where they live (S3 / Confluence / Notion / GitHub / a database / the file system / scraped web) into your processing pipeline.\n\nReal-world failures:\n\n- **stale snapshots.** Your index reflects the corpus from three weeks ago. Users ask about today's runbook; your retriever returns last quarter's. The fix is a refresh cadence with versioning, not a smarter retriever.\n- **silent duplicates.** The same document was crawled three times from three URLs, embedded as three chunks, and now occupies three slots in your top-k. Looks fine in tests; ships as a quality problem.\n- **partial ingests.** Half a folder was loaded before a network error. Nobody noticed because nobody is monitoring "documents added this week" with a threshold.\n- **mixed permissions.** You ingested a doc the user shouldn't see, and now retrieval surfaces it. RAG security failures almost always live here.\n\nThe fix is not technical sophistication. It is content hygiene: dedup by content hash, version your indexes, monitor cardinality changes, gate by access controls **at the index level**, not just at the prompt level.`,
      },
      {
        heading: 'stage 2: parse (the silently broken step)',
        body: `Parsing turns raw bytes into structured text. For HTML it's straightforward-ish. For PDFs it is a nightmare. For Word docs, slides, mixed-content pages — varies wildly.\n\nWhat goes wrong, in approximate order of frequency:\n\n- **tables are flattened to junk.** A 4-column table becomes "Apr Jan 12 Feb 8 Mar 4 Q1 ..." and the model can never recover the structure. Fix: use a parser that emits tables as markdown or HTML.\n- **PDF reading order is wrong.** Multi-column PDFs read column-by-column when a naive parser walks top-to-bottom. The result is interleaved paragraphs that look like nonsense.\n- **headers, footers, page numbers are inline noise.** They appear inside paragraphs and confuse chunkers and embedders.\n- **scanned PDFs need OCR.** If your parser silently returns empty strings for image-only pages, you may have empty chunks. Worse, if OCR succeeds with errors, you have wrong chunks.\n- **inline code is destroyed.** Code blocks lose indentation, identifiers get tokenized wrongly, function names get split.\n\nThe fix is to invest in parsing as a first-class step. Validate randomly sampled outputs by eye. Use multiple parsers if needed and compare. The cost of bad parsing is invisible in retrieval evals (the chunks just look like chunks). It shows up in answer quality and you blame the model.`,
      },
      {
        heading: 'stage 3: chunk',
        body: `Covered exhaustively in [Chunking, the most-ignored knob in RAG](/writing/chunking-the-most-ignored-knob-in-rag). One-line summary: start with fixed-size, respect document structure, consider parent-child for QA workloads, and measure chunk recall@k separately from end-to-end quality.\n\nThe single most useful chunking-stage diagnostic: pick 10 queries where the answer is wrong. For each, find the right chunk in your index by hand (or grep). Was the chunk:\n\n- present? then the issue is downstream (embed / retrieve / generate)\n- absent because the answer was split across chunks? chunking is too aggressive — add overlap or move to parent-child\n- absent because the chunk contains junk? parsing is broken — go back to stage 2\n- present but in a form unlikely to embed well? consider structural prefixes (heading paths) or a different chunker\n\nMost teams skip this exercise because it takes an hour. It is the cheapest hour you will ever spend on RAG.`,
      },
      {
        heading: 'stage 4: embed',
        body: `Embedding turns chunks into vectors. The model choice matters more than people admit, and most defaults are fine.\n\nThe failures that actually bite:\n\n- **changing the embedding model without reindexing.** Old vectors and new vectors live in different geometries. Cosine similarity becomes meaningless. You will discover this when retrieval quality silently halves after a deploy.\n- **wrong distance metric.** Some indexes default to L2 (Euclidean), some to cosine, some to inner product. They are not equivalent except on unit-length vectors. Pick one consciously and stay there.\n- **forgetting query vs passage prefixes.** Modern encoders often expect different inputs for the query side and the document side. Skipping the prefix on one side costs 5-15 points of recall, and the symptom is "retrieval is bad" with no obvious cause.\n- **the dimensions trap.** People assume 3072-dim is twice as good as 1536-dim. It is mostly twice as expensive. Pick by quality on your domain, not size.\n- **a stale index.** Documents change but the embeddings don't. The chunk in your vector store no longer matches the content people are seeing. Always reindex when content changes; never embed once and assume.\n\nA short routine: pin the embedding model version. Reindex on every change. Monitor recall@k weekly with a fixed eval set. If recall ever drops by more than 2 points, suspect this stage first.`,
      },
      {
        heading: 'stage 5: retrieve',
        body: `Retrieval is where most teams ship "good enough" and never come back. Covered in detail in [Hybrid retrieval and rerankers](/writing/hybrid-retrieval-and-rerankers). The two big lessons:\n\n- one retriever is never enough; combine BM25 + dense with RRF\n- a cross-encoder reranker on top-50 typically buys 5-15 points of recall@10 for 100-200ms of latency\n\nThe diagnostic question: when the answer is wrong, **was the right chunk in the top-50 candidates?** If yes, your problem is reranking or generation. If no, your problem is retrieval — chunking, embedding, or the retriever itself.\n\nThis single bit of information ("was the answer reachable from retrieval?") cuts your debugging surface in half. Most teams don't compute it because nobody owns retrieval as a distinct product. Fix that.`,
      },
      {
        heading: 'stage 6: generate (with citations)',
        body: `The final stage: assemble the retrieved chunks into a prompt and ask the model. This is the stage where most attention goes in tutorials and the least where the real gains live.\n\nThe failure modes:\n\n- **the model ignores the context.** Usually because the prompt doesn't make grounding explicit, the chunks are buried in the middle of a long prompt (attention sinks at start and end), or the model "knows" the answer from training and uses that.\n- **the model hallucinates citations.** It dutifully cites \`[1]\` but the chunk \`[1]\` doesn't say what it claims. Fix: ask for exact-quote citations and validate post-hoc.\n- **the model can't distinguish authoritative chunks from supporting ones.** If you retrieve the runbook AND someone's old comment, the model might prefer the comment. Use chunk metadata: source, recency, confidence.\n- **the model answers from one chunk when the answer requires synthesising across many.** Often a prompt problem ("synthesise across the snippets, don't quote one"), sometimes a retrieval diversity problem (MMR helps).\n\nThe generation prompt I keep coming back to:\n\n\`\`\`
Answer the question using ONLY the snippets below. If the answer is
not in the snippets, say "I don't have that in my sources" — do not
guess. Each claim must reference the snippet it came from, like [#3].

Snippets:
[1] source: runbook/auth.md (updated 2026-02-12)
"..."
[2] source: wiki/sessions (updated 2025-09-30)
"..."

Question: ...
\`\`\`\n\nNothing exotic. The combination of "ONLY," the explicit fallback ("I don't have that"), and the citation requirement does most of the work.`,
      },
      {
        heading: 'where each stage actually breaks',
        body:
`A map I keep returning to:\n\n![Six stages, six different failure modes. Diagnose per stage, not per answer.](/blog/diagram-rag-failures.svg)\n\nWhen an answer is wrong, walk the pipeline backward. The right chunk was there in retrieval? Then it's generation. It wasn't there? Then it's chunking, embedding, or retrieval. If it wasn't even in the corpus? Then it's ingest. Each step rules out two or three other stages.\n\nThis is the same debugging discipline you'd use for any UNIX pipeline. RAG is no more mysterious than \`cat | grep | awk | sort\`. It just has a model on the end.`,
      },
      {
        heading: 'pipeline evals beat end-to-end evals',
        body: `An end-to-end eval ("did the answer match the gold answer?") tells you the system is broken. It does not tell you where.\n\nPipeline evals are cheap to add and tell you exactly where to look:\n\n- **ingest:** monitor document count, content hash dedup ratio, ingest age (freshness)\n- **parse:** sample-check parsed outputs by eye, weekly; track empty-page ratio for PDFs\n- **chunk:** chunk recall@k (does any chunk contain the answer span?)\n- **embed:** unchanged-corpus retrieval stability (rerun yesterday's queries and check stability)\n- **retrieve:** recall@k, MRR, nDCG on a labelled eval set\n- **generate:** faithfulness (does the answer match the chunks?), citation accuracy (do the cites point to claims that exist?)\n\nA simple dashboard with these six numbers will tell you in 30 seconds where the regression is. Without it, you are running the same experiment over and over and arguing about which model to use.`,
      },
      {
        heading: 'a few things I would not skip',
        body: `1. **Treat retrieval as a product.** Give it its own owner, its own metrics, its own eval set. The team that does this has dramatically better RAG than the team that treats retrieval as "the part before the model."\n2. **Instrument every stage.** Cheap logs at every transition, queryable later. When something regresses, you want logs, not theories.\n3. **Have a fixed eval set per stage.** 50-100 cases is enough. The point is stability, not coverage.\n4. **Practise the backward walk.** Train your team to diagnose backward from "answer is wrong" through the six stages. The first time it takes an hour. By the tenth time, ten minutes.\n5. **Be skeptical of frameworks that hide stages.** A "one-call RAG" library is great for prototypes and bad for production, because it hides exactly the boundaries you need to inspect.`,
      },
      {
        heading: 'the closer',
        body: `RAG is not magic. It is a pipeline with six well-understood stages, each with well-understood failure modes. The teams that get good at it are not the ones with the best embeddings. They are the ones who internalised the pipeline mental model and built the small habits to debug it.\n\nIf "RAG" is a single noun in your team's vocabulary, you are about to spend a quarter being confused. If it is a pipeline you can name the parts of, you already won the hardest fight.`,
      },
    ],
  },

  {
    slug: 'choosing-an-mcp-transport',
    cover: '/blog/cover-mcp-transports.png',
    title: 'Choosing an MCP transport: stdio vs SSE vs streamable HTTP',
    type: 'deep dive',
    date: 'May 13, 2026',
    readingTime: '12 min',
    color: 'paper-yellow',
    tags: ['mcp', 'transports', 'protocol', 'http'],
    excerpt:
      'Three transports, three operational profiles, three deployment stories. A practical look at when each one is correct, and what their failure modes have in common.',
    seoDescription:
      'A detailed comparison of MCP transports — stdio, HTTP+SSE, and streamable HTTP — with concrete deployment guidance, scaling characteristics, and session-state advice.',
    keywords: 'MCP transport, stdio, SSE, streamable HTTP, MCP server design, MCP session, MCP scaling, Model Context Protocol',
    intro:
      `The MCP protocol is transport-agnostic on paper and pleasantly opinionated in practice. You can run an MCP server in three meaningful ways: as a local subprocess piped over stdio, as a long-lived HTTP server pushing notifications via SSE, or as a "streamable HTTP" endpoint that handles both regular request/response and streaming through a single URL.\n\nEach transport is a different operational profile. Choosing the right one is less about performance and more about who owns the lifecycle, who pays for state, and what your hosting environment will tolerate. This post walks the three with enough detail to make the choice without later regret.`,
    sections: [
      {
        heading: 'the three transports at a glance',
        body: `- **stdio.** Client spawns the server as a subprocess and talks over stdin/stdout. Strictly local. Connection is the process lifetime.\n- **HTTP + SSE.** Client opens a long-lived HTTP GET to the server, which becomes a one-way notification channel (Server-Sent Events). The client makes requests via separate HTTP POSTs. Two channels, one logical session.\n- **Streamable HTTP.** A newer single-endpoint design where every request is an HTTP POST, and the server can choose to respond with a plain JSON body or upgrade to a stream when there is more to send. One channel, simpler ops.\n\nAll three carry the same JSON-RPC payloads. The protocol layer above doesn't change. What changes is how the bytes move, who keeps state, and how the connection ends.`,
      },
      {
        heading: 'stdio: when local and simple wins',
        body: `Stdio is the default for a reason. The model is: the host (Claude Desktop, Claude Code, Cursor) launches your server as a child process. They speak JSON-RPC over stdin and stdout, one JSON object per line (newline-delimited). When the host quits, the child quits.\n\nWhat this gets you:\n\n- **zero auth.** The process boundary is the trust boundary. If the user can run the binary, they can use the server.\n- **zero networking.** No ports, no TLS, no proxies, no CORS, no DNS.\n- **process isolation.** Crashes don't take down the host.\n- **trivial debugging.** You can run the server manually, type JSON into stdin, and see what comes back.\n\nWhat it costs:\n\n- **one user per server.** Each Claude session typically spawns its own subprocess. State is per-session.\n- **no cross-machine.** The server only exists where the client runs. A teammate cannot share your subprocess.\n- **environment is yours to manage.** The server inherits the user's shell environment; misconfigured paths or missing system libraries surface as silent startup failures.\n\nUse stdio for: dev tools, personal automations, anything where the server wraps something on the user's local machine (filesystem, local DB, local script). Avoid it for: anything that touches shared backends, anything that needs centralised auth or rate limiting, anything that has any concept of "team."`,
      },
      {
        heading: 'a useful detail about stdio framing',
        body: `Stdio uses **newline-delimited JSON-RPC**. One message per line. No length prefix, no framing protocol — just JSON terminated by \`\\n\`.\n\nThis sounds simple and bites the people who write servers in languages where stdout is line-buffered, block-buffered, or worse. If you write a server in Python and forget to flush, the host hangs waiting for a response that is sitting in your buffer.\n\nThe practical incantations:\n\n- Python: \`print(json.dumps(msg), flush=True)\` — note the flush.\n- Node: \`process.stdout.write(JSON.stringify(msg) + '\\n')\` — Node's stdout is line-buffered when attached to a TTY but block-buffered when piped. Calling write directly avoids surprises.\n- Go: explicit \`bufio.Writer\` with \`Flush()\` after each write.\n\nIf your stdio server "stops responding" after a few messages, the buffer is the prime suspect. Always.`,
      },
      {
        heading: 'SSE: the long-lived connection model',
        body: `HTTP+SSE was MCP's original networked transport. The pattern:\n\n- client opens \`GET /mcp/sse\`. Server keeps the connection open and writes JSON-RPC notifications and responses as Server-Sent Events.\n- client posts requests to \`POST /mcp/messages\` with a session id. Server pushes the response back through the SSE channel.\n\nTwo channels, one logical session. The server has somewhere to push (the SSE stream), and the client has somewhere to send (the POST endpoint).\n\nThis works well in environments where:\n\n- you can hold connections open for minutes to hours (most VPS, dedicated hosting, k8s with reasonable timeouts)\n- you have a small to medium number of concurrent clients\n- you want server-initiated notifications (resource changes, tool list changes, etc.) without polling\n\nIt does **not** work well behind:\n\n- serverless platforms with strict request timeouts (some let SSE through, many don't)\n- proxies that buffer responses (NGINX with default config, some CDNs); buffered SSE is broken SSE\n- load balancers that don't pin a session to a backend (the POST and the SSE must reach the same server instance)\n- environments where long-lived connections are charged differently or limited\n\nIf your hosting passes all four of those tests, SSE is fine. If any one fails, look at streamable HTTP instead.`,
      },
      {
        heading: 'streamable HTTP: where MCP is heading',
        body: `Streamable HTTP collapses the two SSE channels into one endpoint. Every request is a POST to the same URL. The server decides per-response whether to return a single JSON body (normal HTTP response) or a stream (chunked Server-Sent Events in the same response body).\n\nWhy this matters:\n\n- **simpler ops.** One URL, one auth surface, no session-id-to-backend pinning required for the common case.\n- **serverless-friendly.** Short calls fit in a typical 30-second budget. Streams are opt-in for the calls that need them.\n- **statelessness as a choice.** A pure request/response server (no notifications, no long-running operations) can be fully stateless across instances. Throw it behind a load balancer and you are done.\n- **easier to firewall.** It is just HTTP. Existing infra for HTTP works.\n\nWhat it asks of you:\n\n- if you have server-initiated notifications, the client needs to open a "listening" POST to the server, and the server keeps that one open as a stream. You still need long-lived connections for that subset of calls, but only for those.\n- session id management moves into HTTP headers (\`Mcp-Session-Id\`) instead of being implicit in the SSE channel.\n\nIn 2026 this is the transport I default to for any networked MCP server. It plays well with cloud, with proxies, with auth middleware. The SSE-only transport still exists for backward compat, but new servers should ship streamable HTTP first.`,
      },
      {
        heading: 'a deployment table',
        body: `\`\`\`
                       stdio          SSE              streamable HTTP
local dev              ★★★★★          ★★               ★★★
single user prod       ★★★★           ★★★              ★★★★
shared / multi-tenant  —              ★★★              ★★★★★
serverless host        —              ★                ★★★★
behind a proxy/CDN     —              depends          ★★★★
needs notifications    via subproc    natively         natively (POST stream)
auth & rate limits     process trust  HTTP middleware  HTTP middleware
debugging              cat / tee      curl + sse-cli   curl
\`\`\`\n\nNothing magic here, just the operational shape made explicit.`,
      },
      {
        heading: 'session state: where it lives matters',
        body: `Regardless of transport, every non-trivial MCP server has session state: which tools the client has discovered, which subscriptions are active, any per-session caches, the auth context.\n\nThree places it can live:\n\n- **in the server process, in memory.** Simple. Forces sticky sessions on a load balancer (client must always reach the same instance). Works for stdio always, SSE often, streamable HTTP if you can pin.\n- **in a shared store (Redis, DB).** Adds a hop but makes the server stateless across instances. Required if you want horizontal scaling without pinning.\n- **on the client.** The client passes everything it needs in each request. Maximally stateless server, but increases payload size and shifts complexity to clients.\n\nFor production, I default to: streamable HTTP + a small per-session record in Redis keyed by \`Mcp-Session-Id\`. The server is otherwise stateless. Instances can come and go. The session id is the only thing the load balancer needs to route on, and that only matters when streams are active.`,
      },
      {
        heading: 'auth at the transport layer',
        body: `Stdio handles auth by trust: if the user could run the binary, they're allowed. Done.\n\nSSE and streamable HTTP need real auth. The pattern that has held up:\n\n- **bearer tokens in the \`Authorization\` header.** Standard. Works with every middleware. Easy to rotate. Compatible with most proxies and gateways.\n- **OAuth flows for end-user clients.** The MCP spec includes an authorization flow profile that lines up with OAuth 2.1. Use it when your server is going to be added by users to clients they don't control.\n- **never put secrets in the URL.** Tokens in query strings show up in proxy logs, CDN logs, browser histories, and Bash command history. The \`Authorization\` header is the only correct place.\n- **rate limit by token, not IP.** Multiple users behind a NAT will share an IP and break each other.\n\nIf your auth model is "we don't have one yet, the network is private," your network is not as private as you think. Put a bearer token in front of it on day one.`,
      },
      {
        heading: 'scaling patterns',
        body: `stdio doesn't scale — it's per-user, by design. Don't try.\n\nFor SSE and streamable HTTP:\n\n- **stateless instances + shared session store.** The default. Servers behind a normal load balancer. Sticky sessions only when a stream is actively open.\n- **one instance per tenant.** Useful for very heavy per-tenant state or strict isolation. Higher cost, simpler auth.\n- **read replicas for tool definitions.** If \`tools/list\` is the hot path, cache it at the edge. Most servers have static tool definitions; a CDN can serve them.\n\nA pattern that has bitten me: **don't keep open client connections through your normal API gateway.** Most are not tuned for long-lived connections and will silently drop them under load. Put streaming traffic on a separate ingress with appropriate timeouts.`,
      },
      {
        heading: 'a small decision tree',
        body: `Use **stdio** if:\n\n- the server's job is local (touches the user's machine)\n- exactly one user, exactly one host\n- you want zero ops\n\nUse **streamable HTTP** if:\n\n- multiple users, shared backends\n- you want centralised auth, rate limits, observability\n- you may eventually run multiple instances\n- you live in a cloud / serverless / containerised environment\n\nUse **HTTP + SSE** if:\n\n- you have an existing SSE-based MCP server that works\n- you have a deployment where streamable HTTP isn't supported yet by the client you target\n- otherwise, prefer streamable HTTP\n\nThe protocol on top is the same in all three. The plumbing is what you're choosing.`,
      },
      {
        heading: 'the closer',
        body: `Transports are usually a one-time decision and a long-term consequence. The "wrong" choice rarely makes the server unworkable, but it makes every operational task slightly harder forever — auth, scaling, debugging, observability, multi-tenancy.\n\nDefault to streamable HTTP for new networked servers. Default to stdio for anything local. Reach for SSE only when something specific requires it. Almost everything else — caching, retries, observability, auth — is the same boring HTTP work you'd do for any other server. Which is the entire point.`,
      },
    ],
  },

  {
    slug: 'the-mcp-protocol-under-the-hood',
    cover: '/blog/cover-mcp-protocol-deep-dive.png',
    title: 'The MCP protocol, under the hood: handshake, capabilities, notifications',
    type: 'deep dive',
    date: 'May 12, 2026',
    readingTime: '13 min',
    color: 'paper-blue',
    tags: ['mcp', 'protocol', 'json-rpc', 'agents'],
    excerpt:
      'Most people use MCP without ever looking at the wire. The wire is dull on purpose. The dullness is the interesting part.',
    seoDescription:
      'A close look at the MCP protocol: JSON-RPC framing, the initialize handshake, capabilities negotiation, notifications, cancellation, progress, and the error semantics that actually matter.',
    keywords: 'MCP protocol, Model Context Protocol, JSON-RPC, initialize, capabilities, notifications, cancellation, progress, Anthropic',
    intro:
      `If you have built or integrated an MCP server, you have probably never had to read the wire format. That is by design. MCP sits on top of JSON-RPC 2.0 and the SDK abstracts the framing, retries, and lifecycle.\n\nKnowing what is happening underneath still pays. It changes how you design servers, how you debug them when the SDK is hiding something, and how you reason about the small set of features (notifications, cancellation, progress, capabilities) that come up exactly when you most need them. This post walks the protocol with the kind of detail you'd want if you had to implement an MCP client from scratch on a Friday afternoon.`,
    sections: [
      {
        heading: 'the mental model: it is JSON-RPC, with discipline',
        body: `MCP is JSON-RPC 2.0 with a defined lifecycle, a small set of method names, and a capability negotiation step at the top of every connection. The base protocol you can implement in a hundred lines.\n\nThree kinds of messages travel on the wire:\n\n- **requests.** Have an \`id\`. Expect a single matching response (success or error).\n- **responses.** Have the same \`id\` as the request they answer.\n- **notifications.** Look like requests but have no \`id\` and expect no response. Fire-and-forget.\n\nA single, dull example:\n\n\`\`\`json
// request
{ "jsonrpc": "2.0", "id": 7, "method": "tools/call",
  "params": { "name": "search", "arguments": { "q": "APT-29" } } }

// response (success)
{ "jsonrpc": "2.0", "id": 7,
  "result": { "content": [ { "type": "text", "text": "..." } ] } }

// response (error)
{ "jsonrpc": "2.0", "id": 7,
  "error": { "code": -32603, "message": "internal error",
             "data": { "hint": "the upstream timed out" } } }

// notification (no id)
{ "jsonrpc": "2.0", "method": "notifications/tools/list_changed" }
\`\`\`\n\nThat is the whole vocabulary. Everything else is convention layered on top.`,
      },
      {
        heading: 'the handshake: initialize + initialized',
        body:
`Every MCP session starts with a four-message handshake. Not three. Four.\n\n![Initialize, response, initialized notification, then ready. The shape is rigid for good reasons.](/blog/diagram-mcp-handshake.svg)\n\n- **client → server.** \`initialize\` request. Carries: \`protocolVersion\`, \`clientInfo\` (name + version), and \`capabilities\` (what the client supports — sampling, roots, etc.).\n- **server → client.** \`initialize\` response. Carries: \`protocolVersion\`, \`serverInfo\`, and \`capabilities\` (what the server offers — tools, resources, prompts, logging, etc.).\n- **client → server.** \`notifications/initialized\` notification. Tells the server the client has finished setup and the connection is ready.\n- after that, both sides may start making normal calls (\`tools/list\`, \`tools/call\`, etc.).\n\nThe initialized notification is the part everyone forgets. It is the difference between "the connection exists" and "the connection is ready to do real work." Servers that start sending notifications between step 2 and step 3 are technically violating the spec; clients should ignore them. Servers that wait until step 4 to send anything are correct.`,
      },
      {
        heading: 'capabilities: what each side promises',
        body: `Both \`capabilities\` blocks are how the protocol negotiates features without versioning everything in stone. A client says "I support sampling, roots, and elicitation." A server says "I expose tools (with list_changed notifications), resources (with subscribe and list_changed), and prompts. I do not support logging."\n\nThe rules:\n\n- if a side did not advertise a capability, the other side **must not** use it. A server that didn't advertise \`logging\` should never receive \`logging/setLevel\`.\n- nested capabilities can specify sub-features. \`tools: { listChanged: true }\` means "I support tools, and I will send you \`notifications/tools/list_changed\` when the list changes."\n- capabilities are not extensible past what the spec defines. If you want a new feature, the protocol version goes up.\n\nIn practice: build your server to inspect the client's capabilities and call into them, and build your client to respect the server's. Don't assume; ask.`,
      },
      {
        heading: 'the three primitives, briefly',
        body: `MCP servers expose at most three kinds of things. Each has a "list" and a "use" verb:\n\n- **tools.** Functions the model calls. \`tools/list\` returns definitions; \`tools/call\` invokes one. Tools may have side effects.\n- **resources.** Read-only blobs. \`resources/list\` enumerates them; \`resources/read\` fetches one. Resources may be subscribed to with \`resources/subscribe\` for change notifications.\n- **prompts.** Saved templates a user (or client) may pick. \`prompts/list\` and \`prompts/get\`.\n\nThe distinction between tools and resources matters more than people first think. A tool is something the **model** decides to call, autonomously. A resource is something the **user** (or client UI) picks. Mis-classifying a destructive operation as a resource is how accidents happen; mis-classifying a static document as a tool is how token budgets explode.\n\nWhen in doubt: read-only → resource; side-effectful → tool; templated invocation → prompt.`,
      },
      {
        heading: 'notifications and why they matter',
        body: `Notifications are one-way messages with no \`id\` and no expected response. They are how the protocol stays live without polling.\n\nThe ones worth knowing:\n\n- \`notifications/initialized\` (client → server). Handshake completion.\n- \`notifications/cancelled\` (either direction). Cancellation of a pending request.\n- \`notifications/progress\` (either direction). Progress reports on a long-running request.\n- \`notifications/tools/list_changed\` (server → client). The set of tools has changed; the client should refetch.\n- \`notifications/resources/list_changed\` (server → client). Same for resources.\n- \`notifications/resources/updated\` (server → client). A specific subscribed resource changed.\n- \`notifications/prompts/list_changed\` (server → client). Prompts changed.\n- \`notifications/message\` (server → client, logging). Server-emitted log message at a level the client subscribed to.\n\nIf you are building a server, ship the change notifications. They are how clients keep their cache of your tool surface fresh. Without them, clients are forced to poll \`tools/list\` defensively, which is wasteful and slow.`,
      },
      {
        heading: 'cancellation: how to stop in flight',
        body: `Cancellation is a notification, not a request. Either side can send:\n\n\`\`\`json
{ "jsonrpc": "2.0", "method": "notifications/cancelled",
  "params": { "requestId": 7, "reason": "user cancelled" } }
\`\`\`\n\nThe receiver should stop work on request 7 and may either:\n\n- not respond at all (correct — the request is "withdrawn")\n- respond with an error indicating cancellation\n\nA few realities to know:\n\n- cancellation is **advisory**, not guaranteed. If the response is already on the wire when the cancel arrives, you get the response.\n- the request id may be re-used after cancellation in some implementations; check the SDK.\n- never send a cancellation for a request that hasn't been issued yet — the receiver has no idea what to cancel.\n\nIn server code: register an \`AbortController\` (or equivalent) per request id. On cancel, abort it. Most leaks live in servers that never honour cancel and run the work to completion regardless.`,
      },
      {
        heading: 'progress: the boring win',
        body: `Long-running requests should report progress. The pattern: the requester opts in by including a \`progressToken\` in \`_meta\`; the responder sends \`notifications/progress\` periodically until the request completes.\n\n\`\`\`json
// requester opts in
{ "jsonrpc": "2.0", "id": 11, "method": "tools/call",
  "params": { "name": "ingest_corpus",
              "arguments": { "path": "/data" },
              "_meta": { "progressToken": "ingest-2026-05-12-abc" } } }

// responder reports progress along the way
{ "jsonrpc": "2.0", "method": "notifications/progress",
  "params": { "progressToken": "ingest-2026-05-12-abc",
              "progress": 47, "total": 200,
              "message": "embedding shard 47 of 200" } }
\`\`\`\n\nThe token is opaque; the receiver echoes it back unchanged. Servers that implement progress feel orders of magnitude more pleasant to use than servers that go silent for two minutes and then return a result. The cost is small. Ship it.`,
      },
      {
        heading: 'errors that are actionable',
        body: `JSON-RPC defines a small set of standard error codes:\n\n- \`-32700\` Parse error\n- \`-32600\` Invalid Request\n- \`-32601\` Method not found\n- \`-32602\` Invalid params\n- \`-32603\` Internal error\n- \`-32000\` to \`-32099\` Implementation-defined (free for your use)\n\nMCP defines a few above that, in the \`-32xxx\` range, for things like "resource not found." The numbers matter less than what you put in the body.\n\nThe error envelope I have settled on:\n\n\`\`\`json
{ "code": -32602, "message": "invalid argument 'priority'",
  "data": {
    "field": "priority",
    "received": 9,
    "expected": "integer in [1, 4]",
    "hint": "use list_priorities to see allowed values"
  } }
\`\`\`\n\nWhy each field exists:\n\n- \`code\` is for the client's switch statement; stable, machine-readable\n- \`message\` is for the human reading the log\n- \`data\` is for context — what was wrong, what was expected\n- \`hint\` is for the model that is going to retry; tells it what to do next\n\nIf your errors are "an error occurred," your model is going to apologise and stop. If your errors carry actionable context, your model is going to recover. That is the entire difference between a brittle agent and a robust one.`,
      },
      {
        heading: 'transport layering, briefly',
        body: `JSON-RPC framing depends on transport:\n\n- **stdio.** Newline-delimited JSON. One message per line. Flush after each.\n- **SSE.** Each message is an SSE \`data:\` event with a JSON body. Multi-line JSON must be careful about embedded newlines.\n- **Streamable HTTP.** Each POST body is one JSON message; streaming responses use SSE framing within the response body.\n\nThis is the only layer that changes per transport. Everything above — methods, ids, capabilities, notifications — is the same. Covered in more depth in [Choosing an MCP transport](/writing/choosing-an-mcp-transport).`,
      },
      {
        heading: 'a minimum-viable MCP server',
        body: `Stripped to the bones, an MCP server is roughly this much code (Python, stdio, pseudocode-y but accurate):\n\n\`\`\`python
import sys, json

def respond(msg):
    sys.stdout.write(json.dumps(msg) + "\\n")
    sys.stdout.flush()

CAPS = {"tools": {"listChanged": False}}

def handle(req):
    m = req.get("method")
    if m == "initialize":
        return {"protocolVersion": "2025-06-18",
                "serverInfo": {"name": "tiny-server", "version": "0.1"},
                "capabilities": CAPS}
    if m == "tools/list":
        return {"tools": [{"name": "echo",
                           "description": "echo a string",
                           "inputSchema": {"type":"object",
                                           "required":["s"],
                                           "properties":{"s":{"type":"string"}}}}]}
    if m == "tools/call":
        name = req["params"]["name"]
        args = req["params"]["arguments"]
        if name == "echo":
            return {"content":[{"type":"text","text":args["s"]}]}
        return {"_error":(-32601, f"unknown tool: {name}")}
    return {"_error":(-32601, f"unknown method: {m}")}

for line in sys.stdin:
    line = line.strip()
    if not line: continue
    req = json.loads(line)
    if req.get("method","").startswith("notifications/"):
        continue  # one-way, no response expected
    out = handle(req)
    if "_error" in out:
        code, msg = out["_error"]
        respond({"jsonrpc":"2.0", "id":req.get("id"),
                 "error":{"code":code, "message":msg}})
    else:
        respond({"jsonrpc":"2.0", "id":req.get("id"), "result":out})
\`\`\`\n\nThis isn't production code. It is the shape. Once you have this running, every richer feature — resources, prompts, notifications, cancellation, progress — slots in at the right place. The SDK saves you from writing this yourself, but knowing what it is doing is what lets you reason about it when something goes wrong.`,
      },
      {
        heading: 'the closer',
        body: `MCP's wire format is unexciting. That is the feature. JSON-RPC is one of the few protocols a developer can fully internalise on a weekend, and MCP's discipline on top — the handshake, capabilities, notifications — is a small list of well-chosen patterns you have probably implemented before in other shapes.\n\nWhich means: the time you would otherwise spend learning the protocol can go into the thing that actually matters — what your server exposes, how you describe it, and what your tools return. That is the interesting layer. The wire is just there to get you there.`,
      },
    ],
  },

  {
    slug: 'the-myth-of-perfect-timing',
    cover: '/blog/cover-perfect-timing.png',
    title: 'The myth of perfect timing',
    type: 'observation',
    date: 'May 8, 2026',
    readingTime: '6 min',
    color: 'paper-blue',
    tags: ['decisions', 'courage', 'fear'],
    excerpt:
      'We overestimate timing because it lets us postpone courage. Sometimes that is wisdom. Often it is well-dressed fear.',
    seoDescription:
      'An honest essay on the myth of perfect timing — why we wait, when waiting is wisdom, and when "the moment isn\'t right" is a polite version of fear.',
    keywords: 'timing, decisions, courage, fear, life choices, postponement',
    intro:
      `We overestimate timing because it lets us postpone courage. We tell ourselves the idea is good but the moment is wrong. Sometimes that is wisdom. Often it is well-dressed fear.\n\nMost life does not offer perfect timing. It offers costly windows — narrow openings where the cost of acting is high and the cost of not acting is mostly invisible. The invisibility is the trap.`,
    sections: [
      {
        heading: '"the moment isn\'t right" is the most polite excuse',
        body: `Timing language is socially safe. Nobody argues with timing. You can say "I'll do it when things settle down" or "the market needs to mature first" or "we should wait until the right person joins" and watch the room nod, because waiting is what reasonable adults do.\n\nThis is its main use. Timing language gives you cover. It lets you postpone something difficult while looking like you are making a calculated decision. The problem isn't the cover. The problem is when the cover starts believing itself.`,
      },
      {
        heading: 'the cost of waiting is paid later, in a different currency',
        body: `What looks like preservation is often deferral. The decision is still being made; you are just outsourcing it to time.\n\nWaiting has a few specific costs that do not show up on day one:\n\n- the version of you who could have made the decision is no longer there in two years\n- the people who would have joined you have moved on\n- the small window of cultural permission to try the thing has closed\n- you have rehearsed the postponement so many times it has become a habit\n\nNone of these announce themselves. They show up as a quiet feeling, much later, that you were never quite who you meant to be.`,
      },
      {
        heading: 'what "right time" actually looks like when it is honest',
        body: `Timing is real. There are conditions that genuinely justify waiting:\n\n- a specific resource you need is arriving on a known date\n- you are mid-recovery from something that needs full attention\n- the cost of acting is currently catastrophic and will be merely high in three months\n- you are missing one piece of information that will change the decision, not just decorate it\n\nIf your reason for waiting fits one of these, fine. If it does not — if it is a vague sense that "the time isn't right" or "let me see how things go" — you are not waiting. You are flinching.`,
      },
      {
        heading: 'a small habit that helps you tell the two apart',
        body: `Write down the exact reason you are waiting. Date it. Read it again in three weeks.\n\nIf the reason has changed — if last month it was "I want to wait for the bonus" and this month it is "I want to see how Q3 goes" — the original reason was a cover. You were not waiting for that thing. You were just waiting.\n\nThe trick of this habit is that it makes the cover visible to you. The cover only works while it stays vague. Once it has a date and a sentence, it has a shape, and shapes can be inspected.`,
      },
      {
        heading: 'most timing is not yours to perfect',
        body: `The biggest decisions of my life were made in conditions I did not choose, when I did not feel ready, with information that turned out to be partly wrong. The conditions did not improve. I improved through them.\n\nThis is not heroic. It is just what happens when you stop waiting for a moment that was never going to send a calendar invite.`,
      },
    ],
  },

  {
    slug: 'honesty-with-cushions',
    cover: '/blog/cover-honesty-cushions.png',
    title: 'Some people want honesty with cushions',
    type: 'observation',
    date: 'May 1, 2026',
    readingTime: '6 min',
    color: 'paper-coral',
    tags: ['honesty', 'communication', 'feedback'],
    excerpt:
      'When people say "be honest," they often mean "be honest in a way that lets me keep my current self-image intact."',
    seoDescription:
      'On the difference between real honesty and its softer substitutes — and why most workplaces accidentally reward the wrong one.',
    keywords: 'honesty, candor, feedback, communication, self-image',
    intro:
      `When people say "be honest," they often mean "be honest in a way that lets me keep my current self-image intact." That is honesty with cushions. It is not exactly honesty.\n\nReal honesty changes the temperature in the room. You can feel it land. That is why so many people claim to value it while quietly rewarding its softer substitutes — the gentle phrasing, the disclaimers, the reassurance bundled with every observation, the "but obviously you're great at..." inserted before any difficult truth.`,
    sections: [
      {
        heading: 'the polite version vs. the actual version',
        body: `The polite version sounds like:\n\n> "Maybe consider, if you have time, possibly looking at how the team responded — there might be something there worth thinking about, only if you want to."\n\nThe actual version sounds like:\n\n> "The team is checking out. They are not going to tell you, because you punish bad news. So I am telling you."\n\nBoth are technically honest. Only one of them changes anything.`,
      },
      {
        heading: 'real honesty changes the temperature',
        body: `You can almost always feel the difference. Polite-honesty leaves a room comfortable, then dissolves the moment everyone leaves. Actual-honesty leaves a brief silence, sometimes a long one. The silence is the part that does work.\n\nThis is why honesty is rare. The silence is unpleasant. People who deliver honest sentences without the silence are usually not delivering honest sentences.`,
      },
      {
        heading: 'the substitutes that look like honesty',
        body: `A short list of things that sound like honesty and are not:\n\n- "constructive feedback" with no specific construction in it\n- "I'm just saying" attached to anything\n- praise sandwiches where the meat is two atoms thick\n- "with respect" used to deliver disrespect with deniability\n- "this might just be me" as a way to disclaim a real pattern\n- venting disguised as transparency\n\nEach of these has a place. None of them are honesty.`,
      },
      {
        heading: 'cushions are sometimes correct',
        body: `Not every setting is an honesty setting. There are conversations where the goal is comfort, or grief, or simple kindness, and no honest reading of the room would call for unvarnished truth. Cushions in those moments are not cowardice. They are care.\n\nThe trouble starts when cushions become the default everywhere. Then the difficult conversations the work needs never happen, because the system has accidentally trained everyone to soften past usefulness.`,
      },
      {
        heading: 'a rule that has held up',
        body: `The smaller the audience, the larger the honesty budget. In a one-on-one with someone who can change something, honesty earns its keep. In a 60-person all-hands, it usually doesn't survive contact with the room.\n\nMatch your honesty to the smallest audience that needs it. A direct sentence to one person, on time, will move more than a careful paragraph to a crowd, ever.`,
      },
      {
        heading: 'a quieter version',
        body: `Sometimes the most honest thing in a meeting is a question. "What is everyone not saying right now?" lands harder than any answer. It also costs less, because the room provides the truth and you only have to ask.\n\nUse it sparingly. It works because it is rare.`,
      },
    ],
  },

  {
    slug: 'not-every-breakdown-is-a-crisis',
    cover: '/blog/cover-not-every-breakdown.png',
    title: 'Not every breakdown is a crisis',
    type: 'reflection',
    date: 'April 28, 2026',
    readingTime: '5 min',
    color: 'paper-yellow',
    tags: ['change', 'systems', 'grief'],
    excerpt:
      'Sometimes a breakdown is information. The form was never strong enough for reality.',
    seoDescription:
      'On distinguishing breakdowns that are crises from breakdowns that are data — and why fighting the pain often means missing the message.',
    keywords: 'change, breakdown, crisis, systems thinking, grief, transitions',
    intro:
      `Sometimes a breakdown is information. A relationship, a workflow, a product idea, or a plan stops functioning not because the universe is cruel, but because the form was never strong enough for reality.\n\nThere is pain in that. There is also data. The pain is loud. The data is quieter, and harder to hear over the pain. Most people fight the pain and miss the data.`,
    sections: [
      {
        heading: 'the form was never strong enough for the reality',
        body: `Most things break the way they were always going to break. A team structure that worked for six people does not work for sixty. A relationship built on one shared phase of life does not survive the next phase. A startup built on the assumption of cheap money does not survive expensive money.\n\nThese are not crises. They are what change looks like when it actually arrives. The form held until it could not. That is most forms.`,
      },
      {
        heading: 'pain and data live in the same place',
        body: `When something breaks, the pain shows up first. Pain is older than language. It does not wait its turn.\n\nThe data shows up later, often by minutes, sometimes by years. It sits next to the pain and waits to be noticed. If you only listen to the pain, you fix the pain — which is sometimes useful and sometimes catastrophic, because fixing the pain often means rebuilding the same form that broke.\n\nThe practice is not to ignore the pain. The practice is to also hear the data.`,
      },
      {
        heading: 'questions worth asking before fixing',
        body: `- what was this form actually doing for me?\n- what changed in the reality it was holding up against?\n- am I trying to rebuild the form, or build the next thing it was supposed to become?\n- if the form had communicated this earlier, what would it have said?\n\nNone of these are quick. All of them are cheaper than rebuilding the wrong shape.`,
      },
      {
        heading: 'the temptation to rebuild the same shape',
        body: `Most rebounds — in jobs, in relationships, in product strategies — are unconscious replicas. The same dynamic, with new names. The brain reaches for what it knows.\n\nThe useful pause is the one between the breakdown and the rebuild. In that pause is the only chance to choose differently. After the rebuild starts, the path is already set. The pause is short. Treat it like a window.`,
      },
      {
        heading: 'a short note on grief',
        body: `Even when a breakdown is information, it is also a loss. Treating it only as data is a different kind of avoidance — a clean, intellectual avoidance that lets you skip the part where you actually felt something.\n\nYou can hold both. The form ended. It taught you something. You miss it anyway. None of these cancel each other out.`,
      },
    ],
  },

  {
    slug: 'what-could-go-wrong-the-five-questions',
    cover: '/blog/cover-what-could-go-wrong.png',
    title: 'What could go wrong',
    type: 'reflection',
    date: 'April 22, 2026',
    readingTime: '6 min',
    color: 'paper-coral',
    tags: ['staff engineer', 'reliability', 'systems', 'mindset'],
    excerpt:
      'The most useful thing I picked up on the way to staff-level work was not a technology. It was five questions I now run in my head before anything ships.',
    seoDescription:
      'The five-question mindset that separates senior from staff engineering: what could go wrong, how would we detect it, recover, prove it happened, and prevent it next time.',
    keywords: 'staff engineer mindset, reliability, observability, incident response, audit, blameless postmortem, systems thinking, what could go wrong',
    intro:
      `The most useful thing I picked up on the way to staff-level work was not a framework or a language. It was a sentence — five questions, in order — that I now run in my head before anything consequential ships.\n\nIt is boring. That is the point. The boring questions are the ones nobody asks until the incident review, when it is too late to ask them cheaply.`,
    sections: [
      {
        heading: 'the sentence',
        body: `Before anything ships, I ask:\n\n> What could go wrong, how would we detect it, how would we recover, how would we prove it happened, and how would we prevent it next time?\n\nFive clauses. Each one is a different muscle, and most engineers are strong in the first one and weak in the rest. The gap between senior and staff is mostly the last four.`,
      },
      {
        heading: 'why each clause earns its place',
        body: `**What could go wrong** is the design imagination. It is the part most people can do — name the failure modes, the edge cases, the bad inputs. Necessary, but it is table stakes.\n\n**How would we detect it** is the honest one. It forces you to admit that a failure you cannot see is a failure you will find out about from a customer. If the answer is "we'd notice eventually," you do not have detection — you have luck.\n\n**How would we recover** is the question that turns a panic into a runbook. A rollback path, a kill switch, a way to drain and replay. If recovery is "we'd figure it out live," you are betting the worst moment to think clearly is the moment you will have to.\n\n**How would we prove it happened** is the one juniors skip and auditors never do. When someone asks "did this affect customer X, and when, and what exactly did we send them," the answer lives in an audit log you either built beforehand or did not. You cannot retrofit evidence.\n\n**How would we prevent it next time** is what makes the loop a loop. The answer to this question becomes a new entry in question one for the next thing you build.`,
      },
      {
        heading: 'the questions are a loop',
        body: `Drawn out, the five questions are not a checklist you run once. The fifth answer feeds back into the first, which is why teams that take it seriously get quietly more reliable over time — every incident makes the next design imagination sharper.\n\n![The five questions as a loop: what could go wrong, detect, recover, prove it happened, and prevent it next time — where the fifth answer feeds back into the first.](/blog/diagram-five-questions.svg)`,
      },
      {
        heading: 'the tell',
        body: `Here is the tell I look for in design reviews. A senior engineer presents a design and answers "what could go wrong" thoroughly — they have thought hard about correctness.\n\nA staff engineer refuses to call the design done until all five questions have answers. Not perfect answers. Just answers that exist on purpose, written down, instead of being improvised at 3am during the incident.\n\nThe difference is not intelligence. It is the refusal to treat detection, recovery, evidence, and prevention as someone else's problem or future-you's problem.`,
      },
      {
        heading: 'it is a posture, not a process',
        body: `You can turn this into a template, and templates help. But the real value is when the five questions stop being a document and become a reflex — when you cannot look at a deploy, a migration, or a new dependency without your head quietly running the list.\n\nThat reflex is most of what people mean when they say someone "thinks like a staff engineer." It is not seniority. It is the habit of assuming things break, and refusing to be surprised by it.`,
      },
    ],
  },

  {
    slug: 'designing-for-the-right-to-be-forgotten',
    cover: '/blog/cover-right-to-be-forgotten.png',
    title: 'Designing for the right to be forgotten',
    type: 'deep dive',
    date: 'April 20, 2026',
    readingTime: '8 min',
    color: 'paper-blue',
    tags: ['gdpr', 'privacy', 'data residency', 'architecture', 'backend'],
    excerpt:
      'GDPR reads like a legal problem. In practice the hard parts are engineering decisions you make at the data layer — and they are only hard if you make them late.',
    seoDescription:
      'Treating GDPR as an engineering problem: data residency via the shard key, right-to-erasure made tractable by keeping identifiable data out of prompts and training, and DSARs as a query you can run.',
    keywords: 'GDPR, right to be forgotten, right to erasure, data residency, DSAR, data subject access request, LLM privacy, data minimization, shard key, compliance engineering',
    intro:
      `GDPR reads like a legal document, and the temptation is to treat it like one — hand it to a policy team, collect a checklist, move on. But the clauses that actually bite are engineering decisions, and they are only expensive if you make them after the data is already everywhere.\n\nThis is what "the right to be forgotten" looks like from the data layer, and especially what changes once you have an LLM in the loop.`,
    sections: [
      {
        heading: 'residency is a schema decision, not a policy',
        body: `"EU customer data stays in EU regions" is a sentence a policy doc can write and a database cannot enforce on its own. The way you make it real is to put region into the data model itself.\n\nConcretely: region becomes part of the shard key, so a record physically cannot land in the wrong place. The routing is not a runtime check that someone might forget to add — it is a property of where the row lives. Get this right at design time and residency is free forever. Get it wrong and it is a migration of your entire dataset.\n\nThis is the recurring shape of compliance engineering: the constraint is cheap when it is structural and ruinous when it is a guardrail bolted on after.`,
      },
      {
        heading: 'erasure is easy when there is almost nothing to erase',
        body: `The right to erasure sounds terrifying — find every copy of a person's data, everywhere, and delete it. It becomes tractable the moment you stop scattering identifiable data into places you cannot reach.\n\nTwo rules do most of the work, and both matter more once an LLM is involved:\n\n- **Never put identifiable data in a prompt.** Pass tokens, IDs, and references — not names, emails, or raw records. Prompts get logged, cached, and sometimes retained by third-party providers. Anything you send out is a copy you may not control and cannot reliably delete.\n- **Never fine-tune on customer data.** Model weights are not erasable. There is no DELETE statement for "the thing the model learned." If identifiable data went into training, you cannot honor erasure without retraining — so keep it out of the weights entirely.\n\nFollow both and erasure stops being an archaeology dig.`,
      },
      {
        heading: 'so what does deletion actually touch?',
        body: `When you have minimized correctly, an erasure request touches a small, known set of places: the system of record, the backups (on their own rotation cycle), and a few derived caches you can enumerate.\n\nWhat it does **not** have to touch is the long tail that usually makes this impossible — prompt logs full of personal data, a model you fine-tuned, or a third party's training set you have no control over.\n\n![Why erasure stays tractable: identifiable data never enters prompts or training, so deletion touches only the system of record, backups, and known caches — not weights or third-party logs.](/blog/diagram-erasure.svg)`,
      },
      {
        heading: 'the DSAR clock is 30 days — make it a query',
        body: `A data subject access request gives you roughly 30 days to tell a person everything you hold about them. Thirty days is generous if answering is a query, and impossible if answering is a project.\n\nThe design goal is that "what do we hold on this person" is a question your system can answer by running something, not by convening a meeting. That is, again, a consequence of decisions made early: consistent identifiers, data tied to a subject by design, and minimization that keeps the surface small enough to actually enumerate.`,
      },
      {
        heading: 'the principle underneath all of it',
        body: `Every one of these — residency, erasure, DSARs — gets cheap or expensive based on one choice: whether you designed for it at the data layer or tried to add it later.\n\nThe legal framing makes GDPR feel like someone else's domain. The engineering framing is simpler and more demanding: know where every piece of personal data lives, keep it out of places you cannot reach, and make "find it" and "delete it" things your system can do on command.\n\nDo that, and compliance is a property of the architecture. Skip it, and compliance is a permanent tax paid in migrations and incident reviews.`,
      },
    ],
  },

  {
    slug: 'three-tools-holding-up-our-llm-pipeline',
    cover: '/blog/cover-three-tools-pipeline.png',
    title: 'The three tools holding up our LLM pipeline',
    type: 'field notes',
    date: 'April 18, 2026',
    readingTime: '8 min',
    color: 'paper-yellow',
    tags: ['llm', 'langchain', 'litellm', 'ragas', 'pipeline', 'backend'],
    excerpt:
      'LangChain composes the steps, LiteLLM routes every call, RAGAS scores a sample of what comes out. Field notes on what each one actually earns its place doing.',
    seoDescription:
      'Field notes on three tools running a production LLM pipeline: LangChain for composition (and when to drop to a direct API call), LiteLLM as the gateway, and RAGAS for continuous evaluation.',
    keywords: 'LangChain, LiteLLM, RAGAS, LLM pipeline, threat enrichment, orchestration, LLM gateway, evaluation, faithfulness, answer relevancy, production LLM',
    intro:
      `Most of the LLM work I do is not a chatbot. It is a pipeline — raw input goes in one end, structured, enriched, analyst-ready output comes out the other. Three tools hold that pipeline up, and each earns its place by doing one job well.\n\nThese are the field notes: what LangChain, LiteLLM, and RAGAS actually do for us, and where each one gets out of the way.`,
    sections: [
      {
        heading: 'LangChain composes the steps',
        body: `The pipeline is a sequence — pull the indicators out of a raw report, classify the threat against a taxonomy, enrich with geo and actor context, then summarize it for a human. LangChain is what composes those steps into one thing instead of four scripts taped together.\n\nThe value is the composition: typed steps, retries, and a clean place for each prompt to live. The trap is treating it as mandatory everywhere. On latency-critical paths the orchestration overhead is real, and the right call is to drop to a direct API call. You keep LangChain where the structure pays for itself and you bypass it where speed matters more than tidiness.\n\nThe rule I land on: orchestrate the parts that change often, hand-roll the parts that have to be fast.`,
      },
      {
        heading: 'LiteLLM is the gateway every call goes through',
        body: `Every model call in the pipeline goes through LiteLLM rather than hitting a provider directly. That one indirection buys a lot:\n\n- **Per-tenant rate limiting** so one heavy tenant cannot starve the rest (a Redis sorted set per tenant, scored by timestamp).\n- **Cost attribution** so the bill is explainable per team and per tenant instead of being one terrifying number.\n- **Provider failover** so an outage on the primary degrades to an alternate instead of taking the pipeline down.\n- **One audit surface** — a single place that knows everything sent to a third-party model, which matters enormously the day someone asks.\n\nNone of these can be enforced from inside each calling service. They are centralized concerns, and a gateway is what gives you a center.`,
      },
      {
        heading: 'the shape of the whole thing',
        body: `Put together, the three tools sit at three different layers: LangChain composes the steps, LiteLLM routes every model call those steps make, and RAGAS watches a sample of what comes out.\n\n![One pipeline, three tools: LangChain composes the enrichment steps, LiteLLM routes every model call with rate limiting and failover, and RAGAS scores a 2% sample of output for faithfulness and answer-relevancy.](/blog/diagram-enrichment-pipeline.svg)`,
      },
      {
        heading: 'RAGAS scores a sample of the output',
        body: `A pipeline that produces text can fail silently — the output still looks plausible while quietly drifting wrong. RAGAS is how we catch that before a customer does.\n\nWe sample roughly 2% of production output and score it asynchronously for **faithfulness** (is the answer grounded in the retrieved context, or is it confabulating?) and **answer-relevancy** (does it actually address the input?). The scores land in a dashboard, and a regression over a 24-hour window pages someone.\n\nThis caught a silent prompt regression once — a change that looked fine in review and in spot checks, but quietly dropped faithfulness across the board. The dashboard saw it before anyone reported it. One caveat worth naming: LLM-as-judge scoring has variance, so a human reviews flagged regressions rather than trusting the number blindly.`,
      },
      {
        heading: 'what they have in common',
        body: `The three tools look unrelated — composition, routing, evaluation — but they share a posture. Each one assumes the pipeline will misbehave and gives you a place to deal with it: a structured step you can swap, a gateway you can govern, a score that tells you when output goes bad.\n\nNone of them are exotic. The discipline is in wiring them so that composition, control, and measurement are properties of the system rather than things you bolt on the week before an audit. Boring infrastructure, quietly doing its job, is the whole goal.`,
      },
    ],
  },

  {
    slug: 'tool-use-schemas-and-the-quiet-art-of-reliable-agents',
    cover: '/blog/cover-tool-use-schemas.png',
    title: 'Tool use, schemas, and the quiet art of making agents reliable',
    type: 'deep dive',
    date: 'April 14, 2026',
    readingTime: '13 min',
    color: 'paper-blue',
    tags: ['tool use', 'schemas', 'agents', 'reliability'],
    excerpt:
      'Most agent failures are not "the model is dumb." They are unclear tool descriptions, sloppy schemas, and error messages a model cannot act on.',
    seoDescription:
      'A practical guide to tool use with Claude — JSON schemas, descriptions, errors, idempotency, and the small craft choices that separate a reliable agent from a flaky one.',
    keywords: 'Claude tool use, JSON schema, function calling, Anthropic API, agent reliability, tool design',
    intro:
      `When an agent fails in production, the temptation is to blame the model. Sometimes that is fair. Most of the time it is not.\n\nThe agents I have shipped that worked, worked because of small, unsexy decisions about how tools were described, how schemas were shaped, how errors were phrased, and what was left out. The agents that failed, failed in the same place — usually the schema, occasionally the description, almost never the model.\n\nThis post is the boring craft. If you write tools for Claude (or any tool-using model), this is the layer that decides whether your agent feels like a colleague or like a bag of confidence.`,
    sections: [
      {
        heading: 'The lie of "the model just figures it out"',
        body: `Sometimes, on a small enough problem, the model does just figure it out. Three tools, clean inputs, no edge cases, and the agent looks magic.\n\nThen you scale to twelve tools, partially overlapping, with optional fields, and "just figures it out" turns into "calls the wrong tool 18% of the time, recovers 60% of those, and silently fails the rest." That 18% is your weekend.\n\nThe model is not the variable. Your tool surface is. The good news is the variable is yours to control.`,
      },
      {
        heading: 'A schema is a UX brief',
        body: `Treat your tool's input schema as if you were writing it for a junior engineer who reads it once, fast.\n\nBad:\n\n\`\`\`json
{
  "name": "create_ticket",
  "input_schema": {
    "type": "object",
    "properties": {
      "title": { "type": "string" },
      "team": { "type": "string" },
      "priority": { "type": "integer" },
      "data": { "type": "object" }
    }
  }
}
\`\`\`\n\nThis schema is technically valid and operationally useless. \`team\` could be anything. \`priority\` is unbounded. \`data\` is a black hole.\n\nBetter:\n\n\`\`\`json
{
  "name": "create_ticket",
  "description": "Open a ticket in Linear. Use only when the user explicitly asks to file work — not for general questions.",
  "input_schema": {
    "type": "object",
    "required": ["title", "team", "priority"],
    "properties": {
      "title": { "type": "string", "maxLength": 80, "description": "imperative, ≤80 chars, no trailing punctuation" },
      "team": { "type": "string", "enum": ["eng", "ops", "design", "growth"] },
      "priority": { "type": "integer", "minimum": 1, "maximum": 4, "description": "1=urgent, 4=someday" },
      "labels": { "type": "array", "items": { "type": "string" }, "maxItems": 5 }
    }
  }
}
\`\`\`\n\nNotice what changed. Constraints, enums, max lengths, and a description on each field that tells the model how the field is supposed to look. This is what closes the gap between "the model called it" and "the model called it correctly."`,
      },
      {
        heading: 'Description fields do most of the work',
        body: `If you read tool-use eval failures, the cause is usually a missing or weak description.\n\nThree habits that fixed more bugs than I expected:\n\n1. **Open with a verb.** "Open a ticket." "Search the indicator graph." "Send a message to a Slack channel." The first three words of a description are doing real work.\n2. **Say when NOT to use it.** "Use only when the user explicitly asks to file work." That single sentence prevents the most common over-eager call.\n3. **Mention the side effects.** If a tool sends an email, name it. If it costs money, name it. The model is more conservative with tools whose descriptions mention consequences.\n\nA description like "Filing utility" is the same as no description. The model will guess, and your support inbox will pay for that guess.`,
      },
      {
        heading: 'Error messages your model will actually use',
        body: `The default error message in most code is "an error occurred." That is the same as silence as far as the model is concerned. It does not know what to do next.\n\nThe error format I have settled on:\n\n\`\`\`json
{
  "error": {
    "code": "actor_not_found",
    "message": "no actor with id=ACT-1234",
    "hint": "use list_actors to find valid ids; ids look like ACT-####"
  }
}
\`\`\`\n\n- \`code\` is stable for branching\n- \`message\` is what humans read in logs\n- \`hint\` is what the model reads to recover\n\nThe \`hint\` field is the one that changes behaviour. With it, the model retries with a sensible next call. Without it, the model apologises and stops.`,
      },
      {
        heading: 'When to refuse, when to ask, when to act',
        body: `A reliable agent does three different things on bad input:\n\n- **Refuse** if the action is destructive and ambiguous. "Delete all sessions for user X" with two matching users → refuse, ask for the id.\n- **Ask** if the action is reversible and a small clarification helps. "What priority?" is fine.\n- **Act** if the action is reversible, low-blast-radius, and you have enough info.\n\nYou can encode some of this in the schema (required fields, enums) and some of it in the description ("if multiple users match, return error \`ambiguous_user\`"). The schema is the cheaper place. Use it first.`,
      },
      {
        heading: 'Idempotency is a feature, advertise it',
        body: `Models retry. Sometimes because of a network error, sometimes because they think the previous call failed when it just took a while.\n\nIf your tool is idempotent — calling it twice has the same effect as calling it once — say so in the description. The model will retry confidently and not double-book your calendar.\n\nIf your tool is **not** idempotent — \`send_email\`, \`charge_card\`, \`open_pr\` — the description should say "this has side effects; do not retry on timeout." Better, accept an \`idempotency_key\` parameter and document it. Stripe figured this out a decade ago. The pattern still works.`,
      },
      {
        heading: 'A worked example: the difference one description makes',
        body: `I had a \`run_query\` tool that wrapped a read-only Postgres connection. Clean schema. The model would still call it on questions like "what is our churn last month" without first checking if a pre-computed metric existed in another tool.\n\nThe fix was one sentence in the description:\n\n> "Use \`get_metric\` first if the question is about a known metric (churn, MRR, DAU). Only fall back to \`run_query\` for arbitrary questions."\n\nTool-call accuracy on the relevant eval set went from 64% to 89%. Same model, same schema, same data. One sentence.\n\nThat is the layer this post is about.`,
      },
      {
        heading: 'A short checklist before you ship a tool',
        body: `- the description starts with a verb\n- the description says when **not** to use it\n- side effects are named\n- every string field has either an enum or a max length, or a clear description if neither\n- every numeric field has a min and max\n- error responses include a \`hint\`\n- idempotency is documented (yes or no)\n- the tool name is a verb (\`create_ticket\`, not \`tickets\`)\n- a real call in the test suite passes the JSON schema validator\n\nIf all nine pass, you have already prevented most of the agent failures you would otherwise debug.`,
      },
      {
        heading: 'The quiet part',
        body: `The reliability of an agent is mostly the reliability of its interface.\n\nThe model is the loud part. The schemas, descriptions, and error shapes are the quiet part. The quiet part is where the work is.`,
      },
    ],
  },

  {
    slug: 'why-praise-can-be-its-own-trap',
    cover: '/blog/cover-praise-trap.png',
    title: 'Why praise can be its own trap',
    type: 'observation',
    date: 'April 3, 2026',
    readingTime: '6 min',
    color: 'paper-yellow',
    tags: ['identity', 'approval', 'change'],
    excerpt:
      'Praise is not always freedom. Sometimes it fixes you in place.',
    seoDescription:
      'On how admiration can become a soft prison — and how to step out of being known for a version of yourself you have outgrown.',
    keywords: 'praise, approval, identity, change, growth, validation',
    intro:
      `Praise is not always freedom. Sometimes it fixes you in place. Once people start admiring a particular version of you, it becomes harder to change without disappointing them.\n\nApproval can become a soft prison. It feels good while it is being built, which is why it goes unnoticed for so long.`,
    sections: [
      {
        heading: 'the version of you that gets admired',
        body: `Praise tends to settle on a specific facet of who you are. The reliable one. The funny one. The hardest worker. The person who never makes a fuss. The technical wizard. The strategist. The empath.\n\nThe facet is real. It just isn't the whole picture. Over time, the praise gets attached to that one shape, and the shape starts to feel like the contract. People expect it. You start delivering it. The other parts of you grow quieter, less rehearsed, less load-bearing.\n\nNobody held a meeting about this. Nobody had to.`,
      },
      {
        heading: 'the costs nobody warns you about',
        body: `A few that show up later:\n\n- you become afraid to be visibly bad at something new in front of the people who admire you for being good\n- you say no to opportunities that would require disappointing the people who pay you in approval\n- you keep performing the trait long after it stopped being interesting to you\n- you mistake other people's expectations for your own preferences\n\nNone of these are catastrophic on day one. All of them compound.`,
      },
      {
        heading: 'the part where people miss the old you',
        body: `When you do change, some of the people who admired the old version will not come along. This is not betrayal. They were attached to the version that was useful or comforting to them, and the new version is neither.\n\nThis loss is real. It is also part of the price of being a person and not a fixed exhibit.`,
      },
      {
        heading: 'two ways to step out',
        body: `Two patterns I have watched:\n\n- **gradually.** Add new shapes to your work and life over a year or two. Tolerate the discomfort of being mid-transition. The advantage: lower social cost. The risk: you can stretch the gradual phase indefinitely and never actually leave.\n- **abruptly.** Do the new thing in a way that nobody can ignore. Quit, switch, move, restart. Higher cost, fewer half-lives. The risk: collateral damage you didn't plan for.\n\nBoth work. Neither is moral. The choice depends on how much patience you and the people around you actually have.`,
      },
      {
        heading: 'the kind of praise that doesn\'t trap',
        body: `Some praise is freeing. It tends to be specific, occasional, and aimed at a behaviour rather than a fixed identity. "You were thoughtful in that meeting" is freer than "you are the thoughtful one." The first describes an action. The second issues a contract.\n\nWhen you praise others, prefer behaviours. When you receive praise, hear the behaviour and quietly decline the contract.`,
      },
    ],
  },

  {
    slug: 'memory-systems-for-ai-agents-that-dont-forget',
    cover: '/blog/cover-memory-systems.png',
    title: 'Memory systems for AI agents that don’t forget what matters',
    type: 'deep dive',
    date: 'March 17, 2026',
    readingTime: '12 min',
    color: 'paper-coral',
    tags: ['memory', 'agents', 'context'],
    excerpt:
      'Files beat vector DBs more often than the conference talks suggest. A practical look at agent memory: what to store, what to forget, and what to never touch.',
    seoDescription:
      'How to design memory for AI agents — file-based vs vector vs context-only, naming conventions, staleness, and the boring habits that keep an agent useful across sessions.',
    keywords: 'AI agent memory, persistent memory, vector database, file-based memory, Claude Code memory, MEMORY.md',
    intro:
      `Most of what gets called "agent memory" in 2026 is one of three things: a vector database with too many opinions, a system prompt with too many facts, or a folder of markdown files that quietly outperforms both.\n\nI have used all three. The folder of markdown files keeps winning. Not because vector DBs are bad — they are excellent at what they do — but because the question "what should the agent remember" is almost never a retrieval problem. It is an editorial problem.`,
    sections: [
      {
        heading: 'What people mean when they say "memory"',
        body: `When someone says their agent has memory, they usually mean one of:\n\n- **session memory** — the conversation so far, in context\n- **profile memory** — durable facts about the user (role, preferences)\n- **project memory** — facts about ongoing work (deadlines, scope, decisions)\n- **episodic memory** — past sessions and their outcomes\n- **semantic memory** — knowledge the agent has accumulated, not tied to a specific user\n\nThese have very different access patterns and very different staleness properties. Lumping them into "memory" and reaching for the same tool — usually a vector store — is how you end up with an agent that "remembers" the user's job title from six months ago and proposes a roadmap based on it.`,
      },
      {
        heading: 'Files vs. vector DB vs. context-only',
        body: `Three options, three honest pictures:\n\n- **Context-only.** Cheapest. Forgets at session end. Fine for single-shot tools, useless for anything that wants to "know" the user.\n- **Vector DB.** Powerful for "find me the relevant chunk from a 10k-doc corpus." Bad at "what is the user's role" because that is one fact, not a search problem.\n- **File-based.** A directory of small, named markdown files plus an index. The model reads the index, decides what to load, and operates on the loaded files like a normal human reading notes.\n\nThe pattern that has held up: file-based memory for facts about the user and project, context-only for the current session, and a vector index only when the corpus is large and unstructured (think docs, transcripts, ticket history).`,
      },
      {
        heading: 'Anatomy of a file-based memory',
        body:
`The shape I keep coming back to:\n\n\`\`\`
memory/
  MEMORY.md            ← always loaded; index of everything else
  user_role.md         ← role, prefs, working style
  feedback_testing.md  ← "do not mock the database in tests"
  project_q2_freeze.md ← "merge freeze begins 2026-03-05"
  reference_grafana.md ← "oncall latency dashboard at ..."
\`\`\`\n\n\`MEMORY.md\` is one line per file:\n\n\`\`\`md
- [User role](user_role.md) — staff engineer, deep Go background, new to React
- [Testing rule](feedback_testing.md) — integration tests must hit a real DB
- [Q2 freeze](project_q2_freeze.md) — merge freeze 2026-03-05
- [Grafana dashboard](reference_grafana.md) — oncall latency, paged on red
\`\`\`\n\n![File-based memory has four kinds: user, feedback, project, reference. The index points to all of them.](/blog/cover-memory-systems.svg)\n\nThe agent reads the index every turn. It loads only what looks relevant. The contents are markdown the agent can edit when something changes.\n\nThe whole thing fits in 5kb of context on a normal turn, less on a quiet one. Compare that to a vector DB that loads 12 chunks per query because nothing is structured enough to be specific.`,
      },
      {
        heading: 'Naming things matters more than retrieving them',
        body: `If your memories are named well, retrieval is trivial. If they are named badly, the most expensive embedding in the world will not save you.\n\nNaming rules I follow:\n\n- one fact per file\n- filename is the **topic**, not the **type** (\`user_role.md\` beats \`memory_001.md\`)\n- if you cannot pick a name in five seconds, the memory is too vague to be useful — write the memory to be more specific instead\n- prefix with type so groups stay together: \`feedback_*\`, \`project_*\`, \`reference_*\`, \`user_*\`\n\nThis is a librarian's job, not an engineer's. The librarian wins.`,
      },
      {
        heading: 'Stale memory is worse than no memory',
        body: `An agent that "remembers" something incorrectly is more dangerous than an agent that asks. The memory feels authoritative, so the agent uses it as a fact, and the user is left wondering why their assistant is confidently wrong.\n\nThree habits that help:\n\n- **Date every memory.** Not just \`mtime\`. Inside the file. "Last verified: 2026-03-10."\n- **Verify before acting.** If a memory says "the deploy script is at \`./deploy.sh\`," check the file exists before recommending it.\n- **Decay aggressively.** Project memories about deadlines and scope rot fast. Re-read them at the start of any non-trivial task and update or delete.\n\nThe rule I keep: if a memory is older than the work it describes, treat it as a question, not an answer.`,
      },
      {
        heading: 'What never to put in memory',
        body: `- secrets — even if the memory store is private\n- code patterns — they are in the code, which is the ground truth\n- one-off task details — they belong to the session, not the archive\n- summaries of recent activity — \`git log\` does this better\n- predictions and assumptions — write the fact, not your guess\n\nThe rule of thumb: if a memory could be derived by reading the project right now, do not memoize it.`,
      },
      {
        heading: 'A small worked example',
        body:
`Pretend you are building a coding assistant. The user mentions they prefer terse responses. You save:\n\n\`\`\`md
---
type: feedback
topic: response style
last_verified: 2026-03-15
---

User prefers terse responses with no trailing summaries.

**Why:** said so explicitly mid-session — "I can read the diff."
**How to apply:** stop summarising at the end of every turn.
\`\`\`\n\nThe **why** and **how to apply** lines do the work. They turn a flat preference into a rule the agent can apply confidently to edge cases. "User wants terse responses" alone breaks the moment the user asks for a detailed walkthrough — which is also a thing they sometimes want.`,
      },
      {
        heading: 'What I would skip',
        body: `- **Embedding-of-everything stores.** They are tempting, expensive, and rarely targeted. Use them when you have a corpus, not when you have a profile.\n- **"Auto-summarise the conversation" pipelines.** They lose the parts the agent actually needs.\n- **Long-running graph memories.** Beautiful in talks, brutal to maintain. The cost shows up in week three, not week one.\n\nIf you are evaluating a memory framework, ask: "what does this prevent me from forgetting?" If the answer is "everything," it is the same as nothing.`,
      },
      {
        heading: 'The one habit',
        body: `Memory is editorial. The hard part is not storing or retrieving — it is deciding what is worth keeping. Files force you to make that decision out loud. That is why they keep winning.`,
      },
    ],
  },

  {
    slug: 'the-emotional-side-of-good-engineering',
    cover: '/blog/cover-emotional-engineering.png',
    title: 'The emotional side of good engineering',
    type: 'reflection',
    date: 'March 5, 2026',
    readingTime: '7 min',
    color: 'paper-blue',
    tags: ['engineering', 'craft', 'work'],
    excerpt:
      'Engineering gets described as logic-heavy work, which is true and incomplete. Building systems is always human.',
    seoDescription:
      'A reflection on the emotional craft of engineering — frustration tolerance, ego management, communication, and thinking clearly while the ground keeps shifting.',
    keywords: 'engineering, software craft, frustration tolerance, communication, ego, engineering culture',
    intro:
      `Engineering gets described as logic-heavy work, which is true and incomplete. Good engineering also requires frustration tolerance, ego management, communication, and the ability to think clearly while the ground keeps shifting.\n\nSystems may be technical. Building them is always human.`,
    sections: [
      {
        heading: 'thinking clearly while the ground keeps shifting',
        body: `Most production engineering happens in conditions that would not pass a textbook test. Requirements change mid-build. Constraints arrive through Slack. Half the documentation is wrong. The deadline is an artifact of someone else's anxiety, not the work.\n\nGood engineers do not need ideal conditions. They notice the conditions, adjust, and keep going. Unsteady ground is not the exception; it is the default. Treat it as normal weather, not a crisis. The ones who panic at every shift never get anything beyond the simplest projects done.`,
      },
      {
        heading: 'frustration tolerance is a skill, not a personality',
        body: `Hard problems are mostly long, not hard. They are forty small annoyances stacked on top of each other. Each one is solvable. The pile, taken at once, is what makes people give up.\n\nFrustration tolerance is the practice of staying with the pile without flinching. It is teachable. The two habits that helped me most:\n\n- name the frustration out loud, briefly, then return to the work\n- when stuck, write the smallest possible next sentence in your head, do that, and re-evaluate\n\nBoth sound simple. Both work. Most engineers I admire are not unusually smart. They are unusually patient with the pile.`,
      },
      {
        heading: 'ego management — your own first',
        body: `Engineering culture talks about ego mostly when other people have it. The more useful version is being aware of your own.\n\nA few places where my ego has cost me time I will never get back:\n\n- defending an architectural decision past its expiry date because I made it\n- arguing about a small style preference as if it were a load-bearing principle\n- not asking for help on something I "should" already know\n- writing more code instead of admitting the design was wrong\n\nNone of these were technical mistakes. All of them looked like ones from the outside.`,
      },
      {
        heading: 'communication is technical work',
        body: `An idea you cannot transmit cleanly is functionally a bad idea, no matter how good it is in your head. The transmission cost matters because every other engineer who interacts with it pays that cost too.\n\nThe one habit that has paid back: write things down in the smallest unit that can be argued with. A short doc, a tight PR description, a one-paragraph rationale. The act of writing forces clarity. The artifact survives the conversation. The argument that follows is about the right thing instead of about misunderstandings.`,
      },
      {
        heading: 'what I look for in engineers I want to work with',
        body: `Not in priority order:\n\n- a high tolerance for being wrong\n- the willingness to ask "is this actually true?" out loud\n- a sense of when something is fast enough vs. when it needs the extra week\n- comfort with ambiguity, without using it as cover for laziness\n- enough taste to recognise good work when they encounter it\n- a sense of humour that does not punch down\n\nNotice how few of these are about specific tools or languages. Tools change every five years. The list above doesn't.`,
      },
      {
        heading: 'a note about resilience, not the corporate kind',
        body: `Resilience as a corporate buzzword usually means "absorb more without complaining." That is not the kind I am talking about.\n\nThe useful kind of resilience is closer to a capacity to keep your judgement intact under pressure. It is closer to clarity than to endurance. The engineers who keep working in chaos by abandoning their standards are not resilient. They are just tired.`,
      },
    ],
  },

  {
    slug: 'claude-code-hooks-slash-commands-and-settings',
    cover: '/blog/cover-hooks-slash-commands.png',
    title: 'Hooks, slash commands, and settings: the Claude Code configuration you’re probably missing',
    type: 'guide',
    date: 'February 26, 2026',
    readingTime: '11 min',
    color: 'paper-blue',
    tags: ['claude code', 'configuration', 'hooks'],
    excerpt:
      'The configuration surface most Claude Code users never look at. Permissions, hooks, slash commands, env, and the settings.json that quietly removes half your interruptions.',
    seoDescription:
      'A practical tour of Claude Code configuration: settings.json, permissions, hooks (PreToolUse, PostToolUse, Stop, UserPromptSubmit, Notification), slash commands, env vars. With real examples.',
    keywords: 'Claude Code settings.json, hooks, slash commands, permissions, PreToolUse, PostToolUse, automation',
    intro:
      `Claude Code looks like a chat with a coding agent. It is also a small framework with a configuration surface most people never open. Once you do, half the interruptions disappear, hooks run quietly in the background, and your slash commands do exactly what they are supposed to do.\n\nThis is a tour of the parts of \`.claude/settings.json\` (and its global cousin) that pay back the time it takes to learn them.`,
    sections: [
      {
        heading: 'The three configuration surfaces',
        body: `There are three places config lives:\n\n- \`~/.claude/settings.json\` — global, applies to every project\n- \`<repo>/.claude/settings.json\` — project, checked into git\n- \`<repo>/.claude/settings.local.json\` — project but personal, gitignored\n\nThe rule of thumb: anything universal goes global, anything teamwide goes in the repo settings, anything that is "this is how I personally like Claude to behave on this project" goes in \`settings.local.json\`. The local file overrides project, project overrides global.\n\nGetting this layering right means you can share \`settings.json\` with a team without forcing them to inherit your personal hooks.`,
      },
      {
        heading: 'Permissions: deny first, then earn',
        body:
`Permissions decide which Bash commands and tools run without prompting. The default is good. The team-shared default should usually be tighter than the individual default.\n\nA stripped-down example:\n\n\`\`\`json
{
  "permissions": {
    "allow": [
      "Bash(git status)",
      "Bash(git diff:*)",
      "Bash(git log:*)",
      "Bash(npm test)",
      "Bash(npm run lint)",
      "WebFetch(domain:github.com)"
    ],
    "deny": [
      "Bash(rm -rf:*)",
      "Bash(git push --force:*)",
      "Bash(git reset --hard:*)"
    ]
  }
}
\`\`\`\n\nA few things I have learned:\n\n- **Allow read-only commands aggressively.** The cost of a permission prompt is human attention. \`git status\`, \`ls\`, \`git diff\` should never prompt.\n- **Deny destructive commands explicitly.** Even if the user could approve them at runtime, a deny entry forces them to type the full command in another terminal — a useful speedbump.\n- **Allow tool prefixes for read-heavy MCP servers.** If your team uses a Linear MCP, allowing \`mcp__linear__list_*\` removes a steady drizzle of prompts.`,
      },
      {
        heading: 'Hooks: the part most people skip',
        body: `Hooks are shell commands the harness runs at lifecycle events. The harness, not the model, executes them. Which means: hooks are how you enforce things the model cannot be trusted to remember.\n\nThe hook events I use (Claude Code supports more — check current docs):\n\n- \`PreToolUse\` — before a tool runs. Can deny.\n- \`PostToolUse\` — after a tool runs. Cannot deny, but can format, log, or notify.\n- \`UserPromptSubmit\` — when the user submits. Useful for adding context (today's date, current branch).\n- \`Stop\` — when the agent finishes a turn. Useful for "ping me when it's done."\n- \`Notification\` — when the harness wants to surface something to you.\n\nHere are three hooks that earn their keep on every project:`,
      },
      {
        heading: 'Hook 1: format on save (PostToolUse)',
        body: `The single best hook. After Claude edits a file, run your formatter. Saves you the "you forgot to run prettier" message that nobody reads.\n\n\`\`\`json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "prettier --write $CLAUDE_FILE_PATH 2>/dev/null || true"
          }
        ]
      }
    ]
  }
}
\`\`\`\n\nThe \`|| true\` matters — prettier failing on a file that does not match its config should not block the edit. The hook is best-effort.`,
      },
      {
        heading: 'Hook 2: deny dangerous git operations (PreToolUse)',
        body: `\`\`\`json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "scripts/guard-git.sh"
          }
        ]
      }
    ]
  }
}
\`\`\`\n\nWhere \`scripts/guard-git.sh\` greps the command for \`push --force\` to a protected branch and exits non-zero if found. Hooks that exit non-zero on \`PreToolUse\` block the call.\n\nA hook is the only place to enforce this reliably. The model can be told "do not force-push." A hook makes "do not force-push" structurally true.`,
      },
      {
        heading: 'Hook 3: ping me when it stops',
        body: `\`\`\`json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "osascript -e 'display notification \\"Claude is done\\" with title \\"Claude Code\\"'" }
        ]
      }
    ]
  }
}
\`\`\`\n\nLong-running tasks plus a different tab plus me getting coffee equals "wait, when did this finish?" The Stop hook fixes that.\n\nLinux equivalents: \`notify-send\`. Cross-platform: a tiny TTS wrapper.`,
      },
      {
        heading: 'Slash commands as muscle memory',
        body: `Slash commands live in \`.claude/commands/\` (project) or \`~/.claude/commands/\` (global). Each is a markdown file. The filename becomes the command.\n\n\`\`\`
.claude/commands/ship-pr.md
\`\`\`\n\nInside, a prompt that the harness expands when you type \`/ship-pr\`:\n\n\`\`\`md
You are about to open a PR for the current branch.

1. Run \`git status\` and \`git diff main...HEAD\`.
2. Draft a PR title under 70 characters, in imperative mood.
3. Draft a body with: Summary (2-3 bullets) and Test plan (checklist).
4. Open the PR with \`gh pr create\`.
\`\`\`\n\nWhat earns its keep is not having a slash command — anyone can write that prompt by hand. It is having the same workflow run the same way every time so you stop reinventing it.\n\nMy short list of slash commands that I would not run a project without:\n\n- \`/review\` — review the diff before commit\n- \`/ship-pr\` — open a PR with a generated title and body\n- \`/loop\` — keep running a task on an interval\n- \`/init\` — generate a starting CLAUDE.md\n- \`/security-review\` — read the diff for security risk\n- \`/simplify\` — review changed code for needless complexity`,
      },
      {
        heading: 'Env vars I actually set',
        body: `\`\`\`json
{
  "env": {
    "EDITOR": "code -w",
    "PAGER": "cat",
    "GIT_PAGER": "cat",
    "BUN_INSTALL_VERBOSE": "0"
  }
}
\`\`\`\n\nNothing exciting. \`PAGER=cat\` alone removes a class of "command hung" issues where \`git log\` opens \`less\` and waits forever. The Bash tool does not feed input back into a paged process. Set \`PAGER=cat\` and move on.`,
      },
      {
        heading: 'A real settings.json I use',
        body:
`The whole thing fits on one screen. That is the point.\n\n\`\`\`json
{
  "permissions": {
    "allow": [
      "Bash(git status)",
      "Bash(git diff:*)",
      "Bash(git log:*)",
      "Bash(ls:*)",
      "Bash(rg:*)",
      "Bash(npm test)",
      "Bash(npm run lint)"
    ],
    "deny": [
      "Bash(git push --force:*)",
      "Bash(rm -rf:*)"
    ]
  },
  "env": {
    "PAGER": "cat",
    "GIT_PAGER": "cat"
  },
  "hooks": {
    "PostToolUse": [
      { "matcher": "Edit|Write", "hooks": [ { "type": "command", "command": "prettier --write $CLAUDE_FILE_PATH 2>/dev/null || true" } ] }
    ],
    "Stop": [
      { "hooks": [ { "type": "command", "command": "osascript -e 'display notification \\"Claude is done\\" with title \\"Claude Code\\"'" } ] }
    ]
  }
}
\`\`\``,
      },
      {
        heading: 'What never to put in hooks',
        body: `- network calls that can hang the harness\n- anything that runs longer than ~5 seconds\n- \`git\` operations that mutate state outside the obvious one\n- secrets or auth that should be elsewhere\n- "fun" features\n\nA hook is a sharp tool. Treat it like a pre-commit hook on a real codebase: small, fast, predictable, easy to disable.`,
      },
    ],
  },

  {
    slug: 'the-strange-relief-of-admitting-you-care',
    cover: '/blog/cover-admitting-you-care.png',
    title: 'The strange relief of admitting you care',
    type: 'personal',
    date: 'February 18, 2026',
    readingTime: '6 min',
    color: 'paper-coral',
    tags: ['vulnerability', 'honesty', 'feelings'],
    excerpt:
      'People perform indifference to protect themselves from embarrassment. There is a different kind of peace on the other side.',
    seoDescription:
      'On the cost of pretending not to care, the relief that lives on the other side, and the small change in language that makes admitting it easier.',
    keywords: 'vulnerability, honesty, caring, indifference, emotional honesty',
    intro:
      `People often perform indifference to protect themselves from embarrassment. It is easier to look detached than visibly invested.\n\nBut there is a different kind of peace in simply admitting that something matters to you. It costs ego. It returns honesty.`,
    sections: [
      {
        heading: 'the cost of pretending not to care',
        body: `Performed indifference looks like protection. It is supposed to make rejection cheaper. If I never said I cared, then losing it can't bruise me, the logic goes.\n\nThis has never actually worked for anyone I have watched try it, including myself. The bruise still arrives. It just shows up later, and dressed in a different language — irritation, distance, a sudden need to declare the thing was never important anyway.\n\nThe pretence is expensive. You pay it twice: once in the daily energy of maintaining the mask, once in the strange grief of pretending not to feel something you were quietly feeling the whole time.`,
      },
      {
        heading: 'the relief on the other side',
        body: `Admitting you care is mostly a sentence. "Yeah, this matters to me." The room may not change much. Your interior changes a lot.\n\nThe relief is not about being heard, which is sometimes a bonus and sometimes not on offer. The relief is about not having to keep guarding the secret. Caring takes less energy when you stop disguising it.`,
      },
      {
        heading: 'why caring out loud feels risky',
        body: `Three things that get in the way:\n\n- the worry that the other person will use it against you\n- the worry of appearing uncool or too earnest\n- the worry that admitting you care will make a no harder\n\nThe first is sometimes real and worth measuring. The second is usually about whose approval you are still chasing. The third is upside-down: admitting you care does not make a no harder; it makes the relationship to the no honest.`,
      },
      {
        heading: 'how to say it without making it heavy',
        body: `Caring out loud does not require a speech. It usually only requires removing the hedges from a sentence you were about to say anyway.\n\n"Whatever, sounds fine" → "I'd actually like to do this. Are you in?"\n\n"Either way, no pressure" → "I'd really like a yes here."\n\n"Up to you" → "I have a preference. Can I tell you?"\n\nThe weight people fear is mostly in the hedges, not the caring. Drop the hedges and the sentence becomes shorter, not heavier.`,
      },
      {
        heading: 'a few things this changed',
        body: `- friends got closer, faster\n- I made worse decisions less often, because I was no longer optimising for "looking unbothered"\n- some relationships ended sooner than they would have, which on reflection was the correct outcome\n- my work got more honest in shape, because I stopped pretending I didn't care which projects I was on\n\nNone of this was a personality transplant. It was just the cost of one specific lie going down.`,
      },
      {
        heading: 'the opposite trap: caring loudly about things you don\'t',
        body: `There is a parallel failure: declaring intense feelings about things you mostly don't have feelings about, because it is socially expected. Performative caring is just performed indifference with the polarity flipped.\n\nThe quiet test is simple: would you still feel this way alone in a room with no audience? If yes, the caring is real. If no, you are negotiating, not feeling.`,
      },
    ],
  },

  {
    slug: 'from-prompt-to-pipeline-eval-harness-in-200-lines',
    cover: '/blog/cover-eval-harness-200.png',
    title: 'From prompt to pipeline: a real eval harness in 200 lines',
    type: 'tutorial',
    date: 'February 10, 2026',
    readingTime: '14 min',
    color: 'paper-coral',
    tags: ['evals', 'python', 'tooling'],
    excerpt:
      'You do not need a vendor. A dataset, a runner, a grader, a store, and a diff report — all in under 200 lines of Python — covers most of what you actually need.',
    seoDescription:
      'A complete walk-through of building a small eval harness in Python: dataset format, runner, hybrid rule + LLM grader, DuckDB storage, and a regression-style diff report.',
    keywords: 'eval harness, LLM evals, Anthropic evals, golden dataset, LLM as judge, regression testing, DuckDB',
    intro:
      `Half the conference talks about evals end with "use our hosted product." The product is fine. The talk is also true if you build it yourself in an afternoon, and you will understand your own evals better when you do.\n\nThis is a small, opinionated harness. Five pieces, ~200 lines, and a real pattern for catching regressions before they ship. The code is readable Python; you can port it to anything in a few hours.`,
    sections: [
      {
        heading: 'The five honest pieces',
        body:
`![Five pieces: dataset, runner, grader, store, diff report. Each one is small.](/blog/diagram-eval-harness.svg)\n\n- **Dataset.** Cases the model is graded on.\n- **Runner.** Calls the model on each case.\n- **Grader.** Decides if the output is good. Rules first, judge second.\n- **Store.** Saves runs so you can compare them.\n- **Diff report.** Tells you what changed since the last run.\n\nNothing fancy. Each piece can be one file. Each piece is small enough to throw away and rewrite.`,
      },
      {
        heading: 'The dataset format',
        body:
`A line-delimited JSON file. One case per line.\n\n\`\`\`json
{"id": "ticket-001", "input": "open a P2 ticket on the eng team for flaky logout", "expect": {"tool": "create_ticket", "args": {"team": "eng", "priority": 2}}}
{"id": "ticket-002", "input": "what is our churn rate", "expect": {"tool": "get_metric", "args": {"name": "churn"}}}
{"id": "ticket-003", "input": "thanks!", "expect": {"no_tool": true}}
\`\`\`\n\nWhy line-delimited:\n\n- you can grow it without breaking diffs\n- you can grep it\n- you can shuffle it\n- you can shard it\n- it does not need a parser more sophisticated than \`for line in f\`\n\n\`expect\` is permissive. It can be "must call this tool with these args," "must NOT call any tool," "answer must contain this substring," or "rubric goes here." The grader handles each shape.`,
      },
      {
        heading: 'The runner',
        body:
`The runner is the smallest piece. It calls the model on each case. That is it.\n\n\`\`\`python
import anthropic, json
from pathlib import Path

client = anthropic.Anthropic()

def run_case(case: dict, model: str, tools: list) -> dict:
    resp = client.messages.create(
        model=model,
        max_tokens=2000,
        tools=tools,
        messages=[{"role": "user", "content": case["input"]}],
    )
    return {
        "id": case["id"],
        "input": case["input"],
        "expect": case["expect"],
        "output": [block.model_dump() for block in resp.content],
        "stop_reason": resp.stop_reason,
        "usage": resp.usage.model_dump(),
    }

def run_all(dataset: Path, model: str, tools: list) -> list[dict]:
    cases = [json.loads(line) for line in dataset.read_text().splitlines() if line.strip()]
    return [run_case(c, model, tools) for c in cases]
\`\`\`\n\nNotes:\n\n- enable prompt caching on \`tools\` and any large system prompt before you run more than ~50 cases\n- if you are budget-conscious, parallelize with a small \`asyncio\` wrapper; \`anthropic.AsyncAnthropic\` is the import\n- save \`usage\` so you can chart cost per case`,
      },
      {
        heading: 'The grader: rules first, judge second',
        body:
`The grader is two layers. Cheap deterministic rules first; expensive LLM-as-judge only when rules cannot decide.\n\n\`\`\`python
def grade(case: dict, run: dict) -> dict:
    expect = case["expect"]
    output = run["output"]
    tool_uses = [b for b in output if b["type"] == "tool_use"]

    if "no_tool" in expect:
        ok = len(tool_uses) == 0
        return {"id": case["id"], "ok": ok, "reason": "tool used when none expected" if not ok else "ok"}

    if "tool" in expect:
        if not tool_uses:
            return {"id": case["id"], "ok": False, "reason": "no tool called"}
        first = tool_uses[0]
        if first["name"] != expect["tool"]:
            return {"id": case["id"], "ok": False, "reason": f"called {first['name']} instead of {expect['tool']}"}
        for k, v in expect.get("args", {}).items():
            if first["input"].get(k) != v:
                return {"id": case["id"], "ok": False, "reason": f"arg {k}={first['input'].get(k)!r} != {v!r}"}
        return {"id": case["id"], "ok": True, "reason": "tool + args match"}

    if "rubric" in expect:
        text = "".join(b["text"] for b in output if b["type"] == "text")
        verdict = judge(case["input"], text, expect["rubric"])
        return {"id": case["id"], "ok": verdict["ok"], "reason": verdict["why"]}

    return {"id": case["id"], "ok": False, "reason": "no recognised expect shape"}
\`\`\`\n\nThe \`judge\` function is a small Claude call with a short rubric and the original case visible. Keep it boring:\n\n\`\`\`python
def judge(input_text: str, output_text: str, rubric: str) -> dict:
    resp = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=300,
        messages=[{
            "role": "user",
            "content": (
                f"Rubric:\\n{rubric}\\n\\n"
                f"User asked:\\n{input_text}\\n\\n"
                f"Assistant said:\\n{output_text}\\n\\n"
                "Reply ONLY with JSON: {\\"ok\\": bool, \\"why\\": short string}."
            ),
        }],
    )
    text = "".join(b.text for b in resp.content if b.type == "text").strip()
    return json.loads(text)
\`\`\`\n\nUse a small, fast model for the judge. The judge is not where you spend top-tier inference.`,
      },
      {
        heading: 'Storage and the diff report',
        body:
`A run is a list of \`{id, ok, reason, output, usage}\`. Persist it with the model name and a timestamp. DuckDB is overkill and also delightful for this:\n\n\`\`\`python
import duckdb, time, json
con = duckdb.connect("evals.duckdb")
con.execute("create table if not exists runs (ts double, model text, id text, ok bool, reason text, output text, usage text)")

def save_run(model: str, results: list[dict]):
    now = time.time()
    con.executemany("insert into runs values (?,?,?,?,?,?,?)", [
        (now, model, r["id"], r["ok"], r["reason"], json.dumps(r["output"]), json.dumps(r["usage"]))
        for r in results
    ])
\`\`\`\n\nThe diff report is a single SQL query. Compare the latest two runs of a model:\n\n\`\`\`python
def diff_report(model: str):
    rows = con.execute(\"\"\"
        with last_two as (
          select ts, id, ok, reason from runs
          where model = ?
          and ts in (select distinct ts from runs where model = ? order by ts desc limit 2)
        )
        select id,
               max(case when ts = (select max(ts) from last_two) then ok end) as new_ok,
               max(case when ts = (select min(ts) from last_two) then ok end) as old_ok,
               max(case when ts = (select max(ts) from last_two) then reason end) as new_reason
        from last_two
        group by id
        having new_ok != old_ok
    \"\"\", [model, model]).fetchall()
    for id, new_ok, old_ok, reason in rows:
        flag = "+" if new_ok and not old_ok else "-"
        print(f"{flag} {id}: {reason}")
\`\`\`\n\nThe report shows only what flipped. That is the part you read on a Tuesday morning. Everything else is fine.`,
      },
      {
        heading: 'The thing that surprised me',
        body: `The first time I ran this harness on a real prompt change, the aggregate score went **up** by 4 points.\n\nThe diff report showed the change had broken three cases I cared about — the arg-matching ones — and fixed seven cases I did not care about as much. The aggregate looked good. The actual answer was "this prompt change makes the agent worse where it matters."\n\nThat is the entire reason this post exists. Aggregates lie. Diffs do not.`,
      },
      {
        heading: 'Putting it all together',
        body:
`The script:\n\n\`\`\`python
import json
from pathlib import Path

def main():
    tools = json.loads(Path("tools.json").read_text())
    cases = Path("evals.jsonl")
    model = "claude-sonnet-4-6"
    runs = run_all(cases, model, tools)
    results = [grade(c, r) for c, r in zip([json.loads(l) for l in cases.read_text().splitlines() if l.strip()], runs)]
    for r, run in zip(results, runs):
        run["ok"] = r["ok"]; run["reason"] = r["reason"]
    save_run(model, runs)
    passed = sum(1 for r in results if r["ok"])
    print(f"{passed}/{len(results)} passed")
    diff_report(model)

if __name__ == "__main__":
    main()
\`\`\`\n\nThat is the whole pipeline. Add tracing, parallelism, and richer rubrics later. Or do not. The harness only has to be useful, not impressive.`,
      },
      {
        heading: 'What I would not bolt on',
        body: `- a UI; the JSONL output and a one-screen SQL diff is enough until you have collaborators\n- a "leaderboard"; you are not benchmarking models, you are testing your prompt\n- exotic stat tests; if a 5% swing is in the noise, your dataset is too small\n- "auto-grow the dataset" loops; cases earn their place by hand\n\nKeep the harness small enough that you trust it. The minute you stop trusting your eval, you stop running it.`,
      },
    ],
  },

  {
    slug: 'caching-like-you-mean-it-anthropic-prompt-caching',
    cover: '/blog/cover-prompt-caching.png',
    title: 'Caching like you mean it: Anthropic prompt caching patterns',
    type: 'deep dive',
    date: 'January 22, 2026',
    readingTime: '10 min',
    color: 'paper-yellow',
    tags: ['prompt caching', 'anthropic', 'performance'],
    excerpt:
      '90% off the cached part. The trick is deciding what counts as cached, and not invalidating it by accident.',
    seoDescription:
      'Practical patterns for Anthropic prompt caching: where to put breakpoints, the 5-minute TTL, common anti-patterns, and real numbers from a production workload.',
    keywords: 'Anthropic prompt caching, cache_control, ephemeral cache, prompt caching, cache breakpoints, TTL',
    intro:
      `Prompt caching is the cheapest performance win in the Claude API and the one most people skip on the way to fancier ideas. The mechanic is simple: mark a prefix of your prompt as cacheable, and subsequent requests reusing the same prefix get a steep discount and a latency drop.\n\nThe cost discount is real (around 90% on cached read, with a small write premium on the first hit). The latency improvement is the bigger win for agent loops. The catch is everything in front of "subsequent requests reusing the same prefix" — most of which is your fault, not the API's.`,
    sections: [
      {
        heading: 'What caching actually buys you',
        body: `On a cache hit, the model reads the cached blocks instead of re-tokenising and re-attending to them. You pay a write fee on the first request (slightly more than a normal token) and a read fee on subsequent ones (much less than a normal token, roughly 10%).\n\nThe practical numbers from one of my agent loops:\n\n- system prompt + tool defs + docs: 28,400 tokens\n- without caching: ~1.2s of "first byte" on every turn\n- with caching: ~0.35s on every turn after the first\n- monthly cost: down ~62% on a workload that re-runs the same prefix many times an hour\n\nWhich is to say: if you are not caching, you are paying for the same tokens to be rebuilt every turn.`,
      },
      {
        heading: 'Where to put the four breakpoints',
        body:
`The API allows up to four cache breakpoints (\`cache_control: {"type": "ephemeral"}\`) per request. The order of layers matters because a layer's cache hit depends on everything **before** it being identical.\n\n![The four breakpoints, from most stable on top to most volatile at the bottom.](/blog/diagram-cache-breakpoints.svg)\n\nMy default placement, top to bottom:\n\n- **Breakpoint 1.** End of the system prompt (and any global rules that never change between turns).\n- **Breakpoint 2.** End of the tool definitions block.\n- **Breakpoint 3.** End of the long static context — runbooks, docs, schemas.\n- **Breakpoint 4.** End of the conversation up to (but not including) the latest user turn.\n\nThe latest user turn is fresh; everything else can usually be cached. The trick is making sure those upper layers really are byte-for-byte identical between turns.`,
      },
      {
        heading: 'The five-minute TTL is the real boss',
        body: `Cache entries expire after about five minutes of inactivity. Inside that window, you pay read prices. Outside, the next request rebuilds the cache (write price) and the cycle starts again.\n\nWhich means:\n\n- For interactive sessions, caching almost always wins.\n- For batch workloads, caching wins only if you keep the prefix warm — either by spacing requests within five minutes or by using a longer TTL where available.\n- For one-shot calls, do not bother. The write fee is wasted.\n\nThe other failure mode: long agent thinks. If the model spends ten minutes on a tool loop that returns no new request to the API, the cache cools off. A heartbeat request keeps it warm; a smarter agent loop avoids the silence.`,
      },
      {
        heading: 'Anti-patterns I keep seeing',
        body: `- **Putting the user message above the cache breakpoint.** The cache key includes everything before the breakpoint. If the user message is up there, every turn invalidates the cache. Move it down.\n- **A timestamp at the top of the system prompt.** "It is currently 14:32 UTC on March 17." Looks helpful. Invalidates the cache every minute. If you need the time, put it in the latest user turn or a tool result.\n- **Reordering tool definitions per call.** Some SDKs sort tools alphabetically by default; some do not. If your tools are in a different order each call, your cache is dead. Sort once and freeze.\n- **A nonce in the system prompt.** Sometimes added "for safety." Same problem as the timestamp.\n- **Caching a prompt smaller than the breakpoint cost.** Caching a 200-token system prompt is a rounding error at best. Reach for caching when prefixes are 1k+ tokens.`,
      },
      {
        heading: 'A minimal SDK example',
        body:
`Python SDK, three breakpoints (system, tools, context):\n\n\`\`\`python
from anthropic import Anthropic
client = Anthropic()

system = [
    {
        "type": "text",
        "text": SYSTEM_PROMPT,
        "cache_control": {"type": "ephemeral"},
    }
]

tools = [
    *TOOL_DEFS,  # last tool def in the list will get the cache_control
]
tools[-1]["cache_control"] = {"type": "ephemeral"}

context_message = {
    "role": "user",
    "content": [
        {
            "type": "text",
            "text": LARGE_DOCS_BLOB,
            "cache_control": {"type": "ephemeral"},
        },
        {
            "type": "text",
            "text": current_user_question,  # not cached; this is the fresh part
        },
    ],
}

resp = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1500,
    system=system,
    tools=tools,
    messages=[context_message],
)
print(resp.usage)  # check cache_creation_input_tokens vs cache_read_input_tokens
\`\`\`\n\nThe \`usage\` block tells you the truth. \`cache_read_input_tokens\` should dominate after the second call. If it does not, your prefix is changing somewhere you did not expect.`,
      },
      {
        heading: 'Numbers from a real workload',
        body: `One of our internal agents makes ~140 requests an hour during business hours. Same system prompt, same tools, same large schema. Different user turn each time.\n\nBefore caching: 28k input tokens × 140 ≈ 3.9M tokens/hr at full price.\n\nAfter caching: 28k cached × 139 ≈ 3.9M tokens/hr **at read price** (≈ 10% of full), plus one cache write of 28k tokens.\n\nThe before/after on the bill matched what the math predicted. Latency dropped by about 70% on cache hits — model "first byte" fell to under half a second on average.\n\nNothing else changed. Same model, same prompt, same answer quality.`,
      },
      {
        heading: 'A few habits that keep the cache hot',
        body: `- treat the system prompt as a build artifact: generate it once per session, not per call\n- sort tool definitions deterministically; commit the sort to the repo\n- never embed wall-clock time, request id, or trace id above the breakpoint\n- if you must include "current state" near the top, hash it and only invalidate when the hash changes\n- log \`cache_creation_input_tokens\` and \`cache_read_input_tokens\` at warn-level when reads are zero on a workload that should be hitting; an alert here is gold\n\nCaching is one of those features where the first 80% is mechanical and the last 20% is a habit. The habit is the part that pays.`,
      },
    ],
  },

  {
    slug: 'why-clarity-feels-aggressive-to-confused-systems',
    cover: '/blog/cover-clarity-aggressive.png',
    title: 'Why clarity feels aggressive to confused systems',
    type: 'observation',
    date: 'January 14, 2026',
    readingTime: '6 min',
    color: 'paper-blue',
    tags: ['systems', 'leadership', 'organizations'],
    excerpt:
      'Some systems survive on vagueness. Clarity, in those places, does not feel helpful. It feels threatening.',
    seoDescription:
      'How vagueness becomes load-bearing in some organisations, why clarity feels like aggression there, and how to bring it without becoming the villain.',
    keywords: 'clarity, organisational dysfunction, leadership, ambiguity, accountability',
    intro:
      `Some systems survive on vagueness. It allows people to postpone decisions, spread blame, and protect fragile status arrangements.\n\nIn those places, clarity does not feel helpful. It feels threatening. It exposes the true shape of responsibility.`,
    sections: [
      {
        heading: 'vagueness as a load-bearing structure',
        body: `In a healthy system, vagueness is a temporary state. You don't yet know who owns the new initiative; someone will figure it out by Friday.\n\nIn an unhealthy system, vagueness is the structure. Nobody quite owns the new initiative because owning it would expose how thinly resourced it is, or how poorly defined the goal is, or how much the people involved disagree under their professional language. The vagueness keeps everyone safe from those disclosures. It also keeps the work from happening.\n\nYou can tell a system has reached this state when "let's discuss this offline" is the most-used sentence in every meeting.`,
      },
      {
        heading: 'what confused systems are actually defending',
        body: `Three things, usually:\n\n- **comfort.** Specific decisions create specific losers. Vague decisions create no one to be upset.\n- **status arrangements.** If responsibility is clear, so is failure. Vagueness lets several people quietly take credit and none take blame.\n- **the absence of an actual plan.** If we leave the goal slightly fuzzy, we can keep moving without admitting we don't agree on what we're moving toward.\n\nClarity threatens all three at once. That is why it lands hard.`,
      },
      {
        heading: 'clarity isn\'t aggression, but it lands like one',
        body: `A clear sentence in a confused room has the same effect as a loud one. It punctures something. The room does not always reward you for that, even when the puncturing was needed.\n\nThis is the part most well-meaning people get wrong. They assume clarity is automatically welcome. It rarely is, in the rooms that need it most.`,
      },
      {
        heading: 'how to bring clarity without becoming the villain',
        body: `Some patterns that have worked:\n\n- **propose, don't pronounce.** "Here's what I think we mean. If that's wrong, where exactly is it wrong?" gives the room a way to push back without losing face.\n- **name the discomfort.** "I'm aware this is going to feel pointed; that's not the intent." A short acknowledgement reduces the perceived hostility.\n- **ask, then summarise.** Let people speak first. Then offer the summary. The clarity now feels like translation, not ambush.\n- **time it.** Clarity in the middle of someone else's emotional moment lands as cruelty. Wait for the room to be ready.\n\nNone of these dilute the clarity. They lower the social cost of delivering it.`,
      },
      {
        heading: 'when the system fights back',
        body: `Sometimes the room rejects clarity outright. Vague counter-proposals appear. The discussion gets re-routed to a smaller, safer question. New committees are formed. The clear sentence quietly disappears from the meeting notes.\n\nWhen this happens, you have a real signal. The vagueness is structural. No amount of thoughtful clarity will fix it from your seat. The honest move at that point is to either rise to the level where you can change the structure, or leave it. Anything else is volunteering for a long, useless argument with a system that has been built to win it.`,
      },
      {
        heading: 'the honest closer',
        body: `Clarity is not a personality trait. It is a service. In rooms where it is welcomed, it is the cheapest gift you can offer. In rooms where it is feared, it is a slow-motion declaration of intent — yours, not theirs.\n\nKnow which room you are in before you swing.`,
      },
    ],
  },

  {
    slug: 'the-hidden-cost-of-long-context',
    cover: '/blog/cover-long-context-cost.png',
    title: 'The hidden cost of long context, and what to do about it',
    type: 'deep dive',
    date: 'January 6, 2026',
    readingTime: '10 min',
    color: 'paper-blue',
    tags: ['context', 'performance', 'agents'],
    excerpt:
      'A million tokens is a permission, not a recommendation. The latency, attention, and bug surface get worse the more you fill up.',
    seoDescription:
      'Long context windows are tempting but expensive in latency and attention quality. A practical look at when to use 1M context, when to compress, and patterns that work better than "stuff everything in."',
    keywords: 'long context, 1M context, attention, latency, prompt design, retrieval, Claude context window',
    intro:
      `The 1M-token Claude context is a remarkable engineering feat and an operational footgun. Every time someone shows me a slow, flaky agent, the prompt is north of 200k tokens, and the answer to "what fixed it" is rarely "more context." It is "less."\n\nThis is not a "context is bad" piece. It is a piece about when context earns its weight and when it just slows you down.`,
    sections: [
      {
        heading: 'The big number is a permission, not a recommendation',
        body: `The window says how much you can fit. It does not say how much you should. Three things scale with context length, and not in your favour:\n\n- **Latency.** Time-to-first-token grows with input length. With caching it grows much less, but it grows.\n- **Attention dilution.** Long contexts spread the model's attention thin. The middle of a long context is where things get forgotten — sometimes called the "lost in the middle" effect.\n- **Bug surface.** More text = more chances to contradict yourself, repeat instructions, or include something stale.\n\nIf your prompt is 400k tokens long and your task is "summarize this issue tracker," fine. If your prompt is 400k tokens long and your task is "write a function," look at what you are sending.`,
      },
      {
        heading: 'Latency is the obvious cost',
        body: `On Sonnet-class models in 2026, time-to-first-token at 100k input is roughly 4-7x the latency at 5k input. With prompt caching, the multiplier shrinks but does not vanish.\n\nIf your agent makes 6 tool calls per turn and each one carries a 500ms latency penalty from "long but not actually used" context, you have spent 3 seconds doing nothing for the user. People notice three seconds. People do not notice the prompt size.`,
      },
      {
        heading: 'Attention dilution is real, even quietly',
        body: `Long contexts do not silently keep all information equally available. Models tend to over-weight what is at the start (the "system prompt sweet spot") and the end (the most recent turns). The middle gets less.\n\nThis is why "I told the model the constraint, why didn't it follow it" stories are so often paired with "the constraint was on line 380 of the system prompt." On a short prompt, the constraint sits in the model's foreground. On a long prompt, it competes with everything else.\n\nThe practical workaround:\n\n- put structural constraints at the **top** of the system prompt\n- put recent state at the **bottom** of the messages list\n- assume anything in the middle of a long prompt is consultable, not enforced`,
      },
      {
        heading: 'Cheaper alternatives, in rough order of preference',
        body: `1. **Point to files, do not paste them.** Give the agent a tool to read paths. Let it pull what it needs. Done well, this turns a 200k-token prompt into a 5k-token prompt plus three on-demand reads.\n2. **Summarise, then load on demand.** A two-paragraph summary up top + "ask for the full doc when you need it" beats stuffing the doc.\n3. **Use a vector index.** If the corpus is large and unstructured (transcripts, tickets), a small retrieval step beats the whole-document approach.\n4. **Section the prompt.** If you must include a long doc, give it explicit headings so the model can navigate. "## Auth flow" is better than 12 paragraphs of running prose.\n5. **Compress aggressively after each turn.** If you are running a long session, condense old turns into a "decisions so far" block instead of carrying every message.\n\nThe order matters because it is sorted by ROI. A "read this file when needed" tool is the change that costs the least and saves the most.`,
      },
      {
        heading: 'A small example: a 240k-token agent that did not need to be',
        body:
`I inherited an internal agent whose default prompt was 240k tokens. The reasons sounded good in isolation:\n\n- "we need our security policy in context"\n- "we need the schema for context"\n- "we need the most recent five tickets so it has working memory"\n- "we need our coding style guide"\n\nWhen I traced what the agent actually used, the answer was: 4-8% of the prompt, on most calls. The rest was insurance.\n\nThe fix:\n\n- security policy → tool: \`get_policy(area)\`\n- schema → tool: \`describe_schema(table)\`\n- recent tickets → tool: \`recent_tickets(n=5)\`\n- style guide → file the agent could grep\n\nNew default prompt: 6,800 tokens. Latency dropped, accuracy rose (because the agent was retrieving fresh data instead of stale context), and the bill collapsed.`,
      },
      {
        heading: 'When 1M context is correct',
        body: `Long context is the right answer when the **task** requires holding a large blob in working memory at once. Examples I have seen work well:\n\n- summarising a long meeting transcript or court filing\n- reviewing a sprawling diff that crosses many files\n- migrating a config across many configurations\n- "find all places where X is true" across a known set of files\n\nThe shared property: the model has to **see** all the inputs to do the job. Not "could potentially benefit from seeing." Has to. If a tool can pull the relevant subset, the tool is cheaper, faster, and more accurate.`,
      },
      {
        heading: 'A short rule of thumb',
        body: `Default to small context, with tools to expand on demand. Earn each token in the prompt the way you earn each line of code in a function — by being load-bearing.\n\nIf you cannot say which sentence in the system prompt is doing work on this call, the sentence is probably not earning its keep.`,
      },
    ],
  },

  {
    slug: 'the-quiet-cost-of-being-the-reliable-one',
    cover: '/blog/cover-reliable-cost.png',
    title: 'The quiet cost of being the reliable one',
    type: 'observation',
    date: 'December 28, 2025',
    readingTime: '6 min',
    color: 'paper-yellow',
    tags: ['work', 'reliability', 'identity'],
    excerpt:
      'Reliability becomes a personality trait others admire, and a private tax you keep paying.',
    seoDescription:
      'On the hidden exchange behind being known as the reliable one — what it earns you, what it costs you, and how to redistribute some of it.',
    keywords: 'reliability, work, burnout, expectations, identity, dependability',
    intro:
      `Being reliable sounds flattering until you notice the hidden exchange. People stop checking whether you are okay because they trust you to keep functioning.\n\nReliability becomes a personality trait others admire and a private tax you keep paying.`,
    sections: [
      {
        heading: 'the compliment that becomes a ceiling',
        body: `"You're so reliable" is meant kindly. It is also a status that, once granted, is hard to put down.\n\nReliability is the trait that compounds through repetition. Each time you deliver, the assumption that you will deliver next time gets a little stronger. Eventually, the assumption stops being conscious. Then it stops being verified at all. Then you are reliable not because you choose to be on a given day, but because the system has wired itself around the assumption.\n\nAt that point, the compliment is no longer a description. It is a contract.`,
      },
      {
        heading: 'the private tax',
        body: `Reliability has costs that no one else can see, because the whole point of reliability is that the costs don't show.\n\nA short list:\n\n- the small bookkeeping of every commitment you have not forgotten\n- the energy spent compensating for less reliable colleagues, often invisibly\n- the slow attrition of saying yes to things you would have preferred to decline\n- the weird loneliness of being the person nobody worries about\n\nNone of these are dramatic. All of them are real. They tend to surface around the time the reliable person has the breakdown nobody saw coming, which everyone then describes as "out of nowhere."`,
      },
      {
        heading: 'why people stop asking if you\'re okay',
        body: `Reliability creates a confidence in your stability that becomes a reason not to check on it. The person who is always fine is also the person who is least often asked.\n\nThis is not malice. It is just attention finding the squeaky wheel. The squeaky wheel gets reassurance. The well-oiled wheel gets more work.`,
      },
      {
        heading: 'redistribution most reliable people never do',
        body: `The fix is rarely "stop being reliable." It is closer to redistributing the load you have accidentally accumulated.\n\nA few moves I have watched work:\n\n- name the load out loud, in specific terms, to the people who benefit from it\n- decline new commitments by default, even small ones, for one full quarter\n- delegate the task that you alone know how to do — yes, even though it would be faster to do it yourself, that is exactly the trap\n- let one small thing fail, on purpose, in a low-stakes setting, to see whether the world adjusts\n\nThe last one is the test. Reliable people often discover that the world adjusts faster than they had imagined. The catastrophe was, mostly, in their head.`,
      },
      {
        heading: 'a small habit that helps',
        body: `Once a quarter, write a short list of every recurring thing you are responsible for that nobody assigned you. The list will be longer than you expect. Pick one item. Stop doing it.\n\nNotice that the world keeps spinning. Notice that nobody panics. Notice that you are still considered reliable.\n\nThis is the small piece of evidence the reliable brain needs.`,
      },
      {
        heading: 'the reliable person is allowed to fail too',
        body: `One last thing. The unspoken rule of being the reliable one is that you are allowed to fail occasionally without losing the status, but you have to risk it to find that out. The status is more elastic than it feels from inside it.\n\nThe people who actually love you, professionally or otherwise, are not in love with the trait. They are in love with the person carrying the trait. The trait is allowed to rest.`,
      },
    ],
  },

  {
    slug: 'subagents-and-parallelism-stop-cramming-context',
    cover: '/blog/cover-subagents.png',
    title: 'Subagents and parallelism: stop cramming everything into one context',
    type: 'deep dive',
    date: 'December 16, 2025',
    readingTime: '11 min',
    color: 'paper-yellow',
    tags: ['subagents', 'parallelism', 'agents'],
    excerpt:
      'A subagent is a coworker, not a thread. Treat it like one and your main context stops drowning in tool output it never needed to see.',
    seoDescription:
      'When to fan out work to subagents in Claude Code, how to brief them, how parallel tool calls differ, and the heuristics that keep the main thread useful.',
    keywords: 'Claude Code subagents, parallel tool use, agent orchestration, context isolation, multi-agent, Anthropic',
    intro:
      `The first time I used a subagent properly, I felt slightly silly. I had been building a complicated, single-context agent loop that spent half its tokens digesting tool output it would not need again. A subagent did the same job in a separate context, returned a one-paragraph summary, and the main thread stayed clean.\n\nA subagent is a coworker. The mental model "main agent gives a brief, subagent comes back with a result" is the entire trick.`,
    sections: [
      {
        heading: 'The mental model',
        body:
`A regular agent is one context window doing everything. As the work grows, the context fills with tool calls, intermediate results, and your main goal slowly drifts to the back of attention. Then it forgets a constraint or contradicts itself.\n\nA subagent is a separate context window with its own brief and its own tools. It runs to completion, returns a summary, and disappears. The main agent only sees the summary.\n\n![Main agent up top, three subagents below — explore, plan, review. Each one runs in its own context.](/blog/diagram-subagent-tree.svg)\n\nThe useful bit: anything that would consume a lot of context to verify on its own — a search across many files, a long migration plan, a security review of a diff — is exactly the kind of work that benefits from being walled off.`,
      },
      {
        heading: 'When to fan out',
        body: `My short list of "consider a subagent":\n\n- the task involves reading >5 files just to answer the question\n- the task is bounded and self-contained ("find all callers of X")\n- the task requires a fresh perspective ("review this diff without my plan in context")\n- the work has independent parallel parts ("audit each of these three services")\n\nIf the work satisfies any of these, the cost of spinning up a subagent (a few hundred tokens for the brief, a separate model call, a return summary) is much less than the cost of polluting your main context with the intermediate output.`,
      },
      {
        heading: 'When NOT to fan out',
        body: `Subagents are expensive when used wrong. Skip them when:\n\n- the work is one tool call away from done\n- the main agent already has the relevant context loaded\n- the answer is a single fact you can read directly\n- you would have to write the brief twice — once for yourself, once for the subagent — to get any value\n\nIf you find yourself writing a 600-word brief to ask a subagent to do something the main agent already had everything for, you have found the wrong abstraction.`,
      },
      {
        heading: 'Parallel tool calls vs subagents',
        body: `Two often-confused mechanics:\n\n- **Parallel tool calls.** The model emits multiple tool calls in one response, and the harness executes them in parallel. Same context, same model, same turn. Cheap and fast.\n- **Subagents.** A separate context window with its own brief and tools. Different context, possibly different model, definitely a different conversation.\n\nUse parallel tool calls when the question is "look up these three things." Use subagents when the question is "investigate this thing thoroughly and tell me what you found."\n\nThe wrong move is using a subagent for what should be a parallel tool call. The other wrong move is hand-holding parallelism with sequential calls when one round of parallel calls would do.`,
      },
      {
        heading: 'How I split work in practice',
        body: `Three patterns I keep:\n\n- **Explore + Decide.** The main agent decides. A subagent explores ("find every place we use \`legacy_session_id\`"). The subagent returns a list. The main agent decides what to do with it.\n- **Plan + Review.** The main agent plans. A subagent (with a clean context, possibly a different model) reviews the plan independently. Catches confirmation bias.\n- **Fan out, fold in.** Three subagents do the same kind of work on three independent inputs (three services, three files, three migrations). The main agent collates.\n\nEach pattern keeps the main context thin and the subagent contexts focused.`,
      },
      {
        heading: 'A subagent prompt, written like an actual brief',
        body:
`The single biggest improvement to my subagent results was treating the brief like an actual brief, not a one-line instruction.\n\nBad:\n\n\`\`\`
review the diff in the auth module
\`\`\`\n\nBetter:\n\n\`\`\`
You are reviewing a diff for safety. The diff adds a new \`verify_session()\`
helper to src/auth/session.py. The author claims it replaces the legacy
\`legacy_verify\` function across the codebase.

What I want from you, in 200 words or less:
1. is \`verify_session\` actually equivalent to \`legacy_verify\` for all callers?
2. are there callers still using the legacy function?
3. one concrete risk worth flagging before merge.

If you cannot answer (1) confidently, say so and stop. Do not guess.
\`\`\`\n\nThe bad prompt makes the subagent re-derive the goal. The better prompt tells it what done looks like, lets it stop early, and constrains the output. Same model, dramatically better results.`,
      },
      {
        heading: 'A heuristic I use to decide',
        body: `If verifying the answer myself would take more than 8k tokens of context, the work probably belongs in a subagent.\n\nBelow that, the cost of fanning out exceeds the savings. Above that, you are paying for context bloat in your main thread that you do not need to.\n\nYou can also ask: if this work fails, can the main agent recover from a one-paragraph summary? If yes, fan out. If the main agent needs the intermediate detail, keep it inline.`,
      },
      {
        heading: 'The boring habit that pays',
        body: `Always read the subagent's output before acting on it.\n\nA subagent's summary tells you what it intended to do, not what it actually did. The agent that ran in a different context cannot fully relay the texture of its findings. Treat the summary as a starting point. Verify with a quick read before committing.\n\nThe whole point of subagents is to keep your context useful. A subagent's summary you trust without reading is a cheap source of confident wrongness.`,
      },
    ],
  },

  {
    slug: 'you-can-be-good-at-something-and-still-be-tired-of-it',
    cover: '/blog/cover-good-but-tired.png',
    title: 'You can be good at something and still be tired of it',
    type: 'reflection',
    date: 'December 4, 2025',
    readingTime: '6 min',
    color: 'paper-coral',
    tags: ['career', 'identity', 'change'],
    excerpt:
      'Competence creates a strange trap. The better you get at something, the more people send it your way.',
    seoDescription:
      'On the competence trap — when usefulness outgrows affection, when "the one who" becomes a cage, and the third path most people miss.',
    keywords: 'competence, career change, identity, ingratitude, growth',
    intro:
      `Competence creates a strange trap. The better you get at something, the more people send it your way. Eventually your usefulness begins to outgrow your affection.\n\nThere is a quiet sadness in being known for a skill you no longer want to keep performing. It is one of the reasons successful people sometimes look ungrateful from the outside.`,
    sections: [
      {
        heading: 'usefulness outgrows affection',
        body: `Most people pick up a skill because something about it interested them. The interest does the early work. It compensates for the friction of being bad at the thing while you learn it.\n\nThen you get good. The friction drops. The work gets easier. And, paradoxically, the interest can drop too — because part of what interested you was the difficulty, the puzzle, the proof that you could climb the hill at all.\n\nMeanwhile, the world has noticed your skill. Everyone keeps sending you more of it. The thing you once chose now keeps choosing you back.`,
      },
      {
        heading: 'the inbox of one\'s own making',
        body: `If you are good at one specific thing, your inbox slowly fills with that thing. Other people, mostly with good intentions, route the work toward whoever makes it look easy. They are not wrong to do so — you are the cheapest answer to their question.\n\nBut "you are the cheapest answer" is also a sentence about a small cage. The shape of your week is now mostly other people's discoveries about your competence. The interest that started the whole thing has long since left the room.`,
      },
      {
        heading: 'why this looks like ingratitude from outside',
        body: `From the outside, the math is simple. You are good at the thing. You are paid for the thing. Many people would love to be in your position. What is your problem?\n\nThe problem is not the position. The problem is that the person inside the position is not the person who originally wanted the position. They have grown around the role like a tree growing around a fence. The fence has become invisible to everyone but them.\n\nWhen they say "I want to do something else," it sounds like ingratitude because the people listening can't see the fence.`,
      },
      {
        heading: 'the two paths people usually take',
        body: `- **the leap.** Quit. Switch industries. Pick a new thing that is not yet a cage. The leap works for some people. It tends to work better when there's a specific next thing pulling you, not just the current thing pushing you.\n- **the doubling down.** Tell yourself the tiredness is temporary. Take a sabbatical. Return to the same role. This sometimes works. More often it produces a brief renewal followed by the same fatigue, slightly thicker.\n\nNeither is wrong. Both are common. Both miss a third option that I keep recommending.`,
      },
      {
        heading: 'the third path',
        body: `Stay in the field. Change the angle.\n\nIf you are tired of being the senior IC, become the person who builds the team. If you are tired of being the team builder, become the person who teaches the field. If you are tired of teaching, write about it. If you are tired of writing, do consultancy in adjacent industries that have never seen what you know.\n\nThe specific skill is rarely the cage. The role around the skill is the cage. Change the role and the skill becomes interesting again. This works because you are not abandoning the years you spent; you are putting them to a different use, in a slightly different room.\n\nThe leap and the doubling down both treat the skill as the variable. The third path treats the role as the variable. Most people don't try the third path because it requires admitting that the role they spent so long winning is not the same as the work they actually love.`,
      },
      {
        heading: 'a short note on identity',
        body: `Some part of the trap is that we accidentally collapse "what I am good at" into "who I am." Once you separate them again, the room gets bigger. You can stop doing a thing without ceasing to be the person who could do it.\n\nThe skill is yours. The cage isn't.`,
      },
    ],
  },

  {
    slug: 'ambition-looks-better-from-the-outside',
    cover: '/blog/cover-ambition-outside.png',
    title: 'Ambition looks better from the outside',
    type: 'observation',
    date: 'November 30, 2025',
    readingTime: '6 min',
    color: 'paper-blue',
    tags: ['ambition', 'self-awareness', 'work'],
    excerpt:
      'Pretending ambition is pure makes people worse at handling it. The cleaner we describe it, the less honestly we live it.',
    seoDescription:
      'An honest look at the ingredients of ambition — drive, comparison, ego, hunger, and the fear of disappearing — and what the lived version looks like up close.',
    keywords: 'ambition, drive, ego, self-awareness, motivation, success',
    intro:
      `From a distance, ambition looks clean. It looks like drive, discipline, and purpose. Up close, it is often mixed with insecurity, comparison, ego, hunger, and the fear of disappearing.\n\nI do not say this to diminish ambition. I say it because pretending it is pure makes people worse at handling it. The cleaner we describe it, the less honestly we live it.`,
    sections: [
      {
        heading: 'the clean version vs. the lived version',
        body: `The clean version of ambition is what you read in interviews. "I just love the work." "I want to build something meaningful." "I'm driven by curiosity." All of these are true, in part. None of them are the whole picture.\n\nThe lived version is closer to: I want to do good work AND I want to be respected AND I want to outpace specific people I have decided I am racing AND I want to not be the version of myself I was at twenty AND I am genuinely afraid of becoming small.\n\nThe two versions are not in conflict. They are the same thing said at different distances.`,
      },
      {
        heading: 'the ingredients we don\'t admit',
        body: `A short, accurate list of what often lives inside ambition:\n\n- a comparison set, usually three or four specific people you measure yourself against without naming\n- a fear of being forgotten, especially by the people who knew you before\n- a hunger that has been there since long before you had words for it\n- an ego that wants to be impressive in rooms it has not been invited into yet\n- a private theory of who you would be if the work were taken away\n\nYou are allowed to have these. They are not character flaws. They are most of human motivation, lightly disguised.`,
      },
      {
        heading: 'why purity narratives hurt',
        body: `When ambition gets described as pure drive and pure purpose, two things happen. People who have the messier version feel ashamed of what they actually feel — and so they hide it, even from themselves. And the role models they're trying to emulate become impossible to imitate, because the role models are also lying about what's underneath.\n\nThe whole game ends up performing cleanliness instead of doing the work. Which is the cleanest possible way to spend a life and never produce anything.`,
      },
      {
        heading: 'what honest ambition looks like',
        body: `Honest ambition is allowed to admit:\n\n- yes, I want this, and part of why I want it is the wrong reason\n- yes, I'm comparing, and the comparison is mostly with one specific person, and I should probably say so out loud at some point\n- yes, I'm afraid, and the fear is doing some of the work; I'd rather know that than pretend I'm just calmly executing a plan\n- yes, I might still want this in five years, or I might be embarrassed by how badly I wanted it\n\nThe tone is calmer because nothing is being defended.`,
      },
      {
        heading: 'a note for younger versions of me',
        body: `Three things I wish someone had said earlier:\n\n- you don't have to be ashamed of the parts of your ambition that aren't beautiful; you have to know they're there so they don't drive without you noticing\n- the comparison set you're racing will keep moving; the race will not, in fact, end at any specific finish line\n- the version of you that gets there will be a slightly different person; plan for that, not just for the arriving\n\nNobody told me. I am telling you.`,
      },
      {
        heading: 'the kind that ages well',
        body: `Some forms of ambition age into something I admire. The common thread: the person eventually stopped pretending the drive was pure, and got curious about its sources. They stopped performing it, and started using it.\n\nAmbition you have made peace with is the one that lasts. The one you are still narrating to yourself at forty in someone else's vocabulary tends to flatten.`,
      },
    ],
  },

  {
    slug: '12-best-claude-code-plugins-and-skills',
    cover: '/blog/cover-12-best-plugins.png',
    title: '12 Claude Code plugins and skills worth installing today',
    type: 'roundup',
    date: 'November 25, 2025',
    readingTime: '13 min',
    color: 'paper-coral',
    tags: ['plugins', 'skills', 'claude code', 'roundup'],
    excerpt:
      'Twelve plugins and skills I have actually used past the demo stage. Each one earns its keep on a real codebase.',
    seoDescription:
      'A practical roundup of 12 Claude Code plugins and skills — code review, security review, ship-pr, init, loop, simplify, security checks, eval helpers, and more. Honest take on what each does.',
    keywords: 'Claude Code plugins, Claude Code skills, github plugins, slash commands, /review, /security-review, /loop, /init',
    intro:
      `Most "best plugins" lists are made of cool demos that nobody uses past Tuesday. This is the opposite. These twelve plugins and skills I have run on at least one real project for at least a week. A few I run daily.\n\nNot every entry is a public plugin you can install with one command. Some are skills you write into \`.claude/skills/\`. Some are scripts that earn their keep enough to be aliased into your workflow. The point is the function, not the package manager.\n\nIf you are new to Claude Code skills, the previous post on [how to write a Claude Code skill](/writing/how-to-write-a-claude-code-skill) is a good entry point.`,
    sections: [
      {
        heading: 'How I picked these',
        body: `Three filters:\n\n- I have used it on a project that someone else was also working on\n- It made a measurable difference (saved time, caught a bug, removed a habit)\n- I would notice if it disappeared\n\nThings I excluded: anything that sounded clever in a demo and never came up again, anything that requires more setup than it is worth, and anything that overlaps with the editor I already use.`,
      },
      {
        heading: '1. /review — read your own diff like a stranger',
        body: `The single highest-value slash command. Before you commit, \`/review\` asks Claude to read the diff with no context other than the diff itself. It catches:\n\n- functions you "renamed" but only changed the call sites\n- console.logs you forgot\n- comments referring to the old behaviour\n- subtle off-by-one in tests you wrote three minutes ago\n\nThe value is not that Claude is smarter than you. The value is that the diff is unfamiliar to it, which is the state you want a reviewer in.`,
      },
      {
        heading: '2. /security-review — adversarial reading of the diff',
        body: `Same diff, different lens. \`/security-review\` reads the changes specifically for security risk: missing input validation, secrets in logs, broken auth assumptions, SQL string concatenation, unbounded recursion that could be a DoS, etc.\n\nIt is not a replacement for a real audit. It is the fast pre-PR pass that catches the easy wins so the human reviewer can focus on the subtle ones.`,
      },
      {
        heading: '3. /ship-pr — open the PR with a real title and a real test plan',
        body: `Generates a PR title, summary, and test plan from the actual diff. The output is consistent across the team because the slash command is consistent. Saves the "I will write the PR description tomorrow" cycle.\n\nThe trick is the prompt: it asks Claude to look at \`git log\`, \`git diff main...HEAD\`, and the touched files, then draft a description that focuses on the **why**, not the what. Anyone reading the PR can see the what in the diff.`,
      },
      {
        heading: '4. /init — generate a starter CLAUDE.md',
        body: `Claude Code reads CLAUDE.md from the project root and uses it as durable instructions. \`/init\` walks the codebase, identifies the stack, conventions, scripts, and "things that would surprise a new contributor," and writes a starter CLAUDE.md.\n\nYou will edit it. That is fine. The first draft existing is the win.`,
      },
      {
        heading: '5. /loop — run a task on an interval (or self-paced)',
        body: `Two modes:\n\n- \`/loop 5m /babysit-prs\` — run \`/babysit-prs\` every five minutes\n- \`/loop /watch-build\` — let the agent decide when to check back\n\nThe self-paced version is the interesting one. It picks reasonable wake-up intervals based on what it is watching, and stays out of the way otherwise.\n\nGood for: deploys you are nervously watching, long builds, batch jobs that report status only at the end.`,
      },
      {
        heading: '6. /simplify — challenge the diff to be smaller',
        body: `Reads your changes and asks "is any of this unnecessary?" The honest answer is usually yes. Three small wins it consistently surfaces:\n\n- error handling for cases that cannot happen\n- helper functions used in exactly one place\n- comments that restate the next line of code\n\nThe vibe is "second pair of eyes that does not have your ego attached to the implementation."`,
      },
      {
        heading: '7. /graphify — turn loose notes into a knowledge graph',
        body: `Less about code, more about thinking. Feed it a doc, a chat dump, a paper, or even a folder, and it returns a graph (HTML + JSON + an audit report) of the concepts and how they connect.\n\nUseful for: making sense of a sprawling design discussion before a meeting, finding the ideas in a paper that other ideas keep referring to, deciding which threads to pick up first.`,
      },
      {
        heading: '8. /security-review (project-specific variant) — your own threats',
        body: `The generic version is good. A project-specific version is better. Write a skill in \`.claude/skills/\` that loads your specific threat model — auth flow, data classification rules, the three things your team has been bitten by — and runs through them on every diff.\n\nThe shape:\n\n\`\`\`md
---
name: security-review-app
description: Security review specifically tuned for this app — checks
  the auth boundary, PII handling, and the three patterns we have
  been burned by (sql concat, unbounded loops in webhook handlers,
  missing tenant scoping).
---

# Steps
1. read the diff vs main
2. for each touched file, check ...
3. flag any of the three patterns ...
\`\`\`\n\nGeneric tools are a starting point. Project-specific skills are where reliability lives.`,
      },
      {
        heading: '9. /test-fix — the test failed, ask Claude to investigate',
        body: `Pipe the failing test output to a skill that:\n\n1. reads the failing test\n2. reads the file under test\n3. proposes a hypothesis (test wrong vs code wrong)\n4. produces either a code fix or a test fix\n\nThe key is step 3. A naïve "make the test pass" agent will edit the test until it does, which is the opposite of useful. The hypothesis step forces a real read.`,
      },
      {
        heading: '10. /migrate — do the boring change everywhere',
        body: `For mechanical migrations: rename a function, swap a library, change an import. The agent reads the change you want, finds the call sites, edits each one, and runs the tests after each batch.\n\nThe trick: never let it commit until you have read the diff. The agent is faster than you, not more careful.`,
      },
      {
        heading: '11. /eval — run the local eval suite and diff vs last',
        body: `Pairs with [the small eval harness](/writing/from-prompt-to-pipeline-eval-harness-in-200-lines) idea. \`/eval\` runs the local eval suite, saves the run, and prints a diff of which cases flipped vs last run.\n\nMakes evals something you can run before a commit, not a "we will set them up next quarter" project.`,
      },
      {
        heading: '12. /ultrareview — multi-agent cloud review of the whole branch',
        body: `When the change is bigger than a single review can cover, \`/ultrareview\` spins up a multi-agent cloud review of the current branch (or a PR number). Several reviewers, separate contexts, comparing notes.\n\nHigh-value, costs real tokens, not a daily driver. Save it for the changes you would normally pull a senior teammate into.`,
      },
      {
        heading: 'Honourable mentions',
        body: `Things I install but use less:\n\n- \`/perf-check\` — looks for obvious O(n²) regressions in the diff\n- \`/spelling\` — catches dumb typos in user-facing strings\n- \`/changelog\` — drafts a changelog entry from the diff\n- \`/explain\` — narrates a file for someone joining the project\n\nNothing wrong with these; just lower frequency than the twelve above.`,
      },
      {
        heading: 'One I removed',
        body: `Anything that auto-commits without asking. Tried it. The first week, brilliant. The second week, a bad commit. The third week, removed.\n\nThe rule I keep: a tool that takes a destructive action without confirmation has to be right about 999 times for every one mistake. Most are not.`,
      },
    ],
  },

  {
    slug: 'some-truths-arrive-wearing-jokes',
    cover: '/blog/cover-truths-jokes.png',
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
    cover: '/blog/cover-claude-code-production.png',
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
    cover: '/blog/cover-systems-fail-quietly.png',
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
    cover: '/blog/cover-psychology-of-work.png',
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
    cover: '/blog/cover-evals-dont-lie.png',
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
    cover: '/blog/cover-claude-code-skill.png',
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
    cover: '/blog/cover-mcp-explained.png',
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
    cover: '/blog/cover-prompt-engineering.png',
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
    cover: '/blog/cover-token-optimization.png',
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
