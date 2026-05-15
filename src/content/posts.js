export const posts = [
  /*
   * NOTE: this post is intentionally unpublished. Kept here so it can be
   * restored later by removing the comment wrapper. Cover and diagrams
   * for it still live in /public/blog/.
   *
  {
    slug: 'mcp-servers-i-built-and-what-they-taught-me',
    cover: '/blog/cover-mcp-servers-built.svg',
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

  {
    slug: 'chunking-the-most-ignored-knob-in-rag',
    cover: '/blog/cover-rag-chunking.svg',
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
    cover: '/blog/cover-rag-anatomy.svg',
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
    cover: '/blog/cover-mcp-transports.svg',
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
    cover: '/blog/cover-mcp-protocol-deep-dive.svg',
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
    cover: '/blog/cover-perfect-timing.svg',
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
    cover: '/blog/cover-honesty-cushions.svg',
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
    cover: '/blog/cover-not-every-breakdown.svg',
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
    slug: 'tool-use-schemas-and-the-quiet-art-of-reliable-agents',
    cover: '/blog/cover-tool-use-schemas.svg',
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
    cover: '/blog/cover-praise-trap.svg',
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
    cover: '/blog/cover-memory-systems.svg',
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
    cover: '/blog/cover-emotional-engineering.svg',
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
    cover: '/blog/cover-hooks-slash-commands.svg',
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
    cover: '/blog/cover-admitting-you-care.svg',
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
    cover: '/blog/cover-eval-harness-200.svg',
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
    cover: '/blog/cover-prompt-caching.svg',
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
    cover: '/blog/cover-clarity-aggressive.svg',
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
    cover: '/blog/cover-long-context-cost.svg',
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
    cover: '/blog/cover-reliable-cost.svg',
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
    cover: '/blog/cover-subagents.svg',
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
    cover: '/blog/cover-good-but-tired.svg',
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
    cover: '/blog/cover-ambition-outside.svg',
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
    cover: '/blog/cover-12-best-plugins.svg',
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
