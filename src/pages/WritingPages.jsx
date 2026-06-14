import { Link, useParams } from 'react-router-dom';
import { posts } from '../content/posts';
import { Paper, PostCard, SectionLabel } from '../components/Shared';
import { useSEO, SITE_ORIGIN } from '../components/useSEO';

const QUOTE_OPENERS = ['“', '"', '‘', "'"];
const ATTRIBUTION_OPENERS = ['–', '—', '-', 'Source:'];

function startsWithAny(text, list) {
  return list.some((p) => text.startsWith(p));
}

function parseBlocks(text) {
  const lines = text.split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({ type: 'code', lang, content: codeLines.join('\n') });
      continue;
    }

    if (line.startsWith('### ')) {
      blocks.push({ type: 'h3', content: line.slice(4) });
      i++;
      continue;
    }

    const trimmed = line.trim();
    const imgMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imgMatch) {
      blocks.push({ type: 'img', alt: imgMatch[1], src: imgMatch[2] });
      i++;
      continue;
    }

    if (/^- /.test(line)) {
      const items = [];
      while (i < lines.length && /^- /.test(lines[i])) {
        items.push(lines[i].slice(2));
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    if (line.startsWith('> ')) {
      const quoteLines = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      blocks.push({ type: 'callout', content: quoteLines.join(' ') });
      continue;
    }

    if (line.trim() === '') {
      i++;
      continue;
    }

    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('```') &&
      !/^- /.test(lines[i]) &&
      !/^\d+\.\s/.test(lines[i]) &&
      !lines[i].startsWith('### ') &&
      !lines[i].startsWith('> ') &&
      !/^!\[.*?\]\(.*?\)$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    const para = paraLines.join(' ').trim();
    if (!para) continue;

    if (startsWithAny(para, QUOTE_OPENERS) && para.length > 40) {
      blocks.push({ type: 'blockquote', content: para });
    } else if (startsWithAny(para, ATTRIBUTION_OPENERS)) {
      blocks.push({ type: 'attribution', content: para });
    } else {
      blocks.push({ type: 'p', content: para });
    }
  }
  return blocks;
}

function renderInline(text) {
  if (!text) return null;
  const out = [];
  let remaining = text;
  let key = 0;
  const codeRe = /`([^`]+)`/;
  const boldRe = /\*\*([^*]+)\*\*/;
  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/;

  while (remaining.length) {
    const codeM = remaining.match(codeRe);
    const boldM = remaining.match(boldRe);
    const linkM = remaining.match(linkRe);
    const candidates = [codeM, boldM, linkM]
      .filter(Boolean)
      .sort((a, b) => a.index - b.index);
    if (!candidates.length) {
      out.push(<span key={key++}>{remaining}</span>);
      break;
    }
    const next = candidates[0];
    if (next.index > 0) {
      out.push(<span key={key++}>{remaining.slice(0, next.index)}</span>);
    }
    if (next === codeM) {
      out.push(<code key={key++} className="inline-code">{next[1]}</code>);
    } else if (next === boldM) {
      out.push(<strong key={key++}>{next[1]}</strong>);
    } else if (next === linkM) {
      const href = next[2];
      const isExternal = /^https?:/i.test(href);
      out.push(
        <a
          key={key++}
          href={href}
          className="inline-link"
          {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {next[1]}
        </a>,
      );
    }
    remaining = remaining.slice(next.index + next[0].length);
  }
  return out;
}

function RichText({ text, className }) {
  const blocks = parseBlocks(text);
  return blocks.map((block, idx) => {
    switch (block.type) {
      case 'code':
        return (
          <pre key={idx} className="article-code" data-lang={block.lang || ''}>
            <code>{block.content}</code>
          </pre>
        );
      case 'h3':
        return <h3 key={idx} className="article-h3">{renderInline(block.content)}</h3>;
      case 'img':
        return (
          <img
            key={idx}
            className="article-inline-img"
            src={block.src}
            alt={block.alt}
            loading="lazy"
          />
        );
      case 'ul':
        return (
          <ul key={idx} className="article-list">
            {block.items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}
          </ul>
        );
      case 'ol':
        return (
          <ol key={idx} className="article-list">
            {block.items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}
          </ol>
        );
      case 'callout':
        return <aside key={idx} className="article-callout">{renderInline(block.content)}</aside>;
      case 'blockquote':
        return <blockquote key={idx} className="article-quote">{renderInline(block.content)}</blockquote>;
      case 'attribution':
        return <p key={idx} className="article-attribution">{renderInline(block.content)}</p>;
      default:
        return <p key={idx} className={className}>{renderInline(block.content)}</p>;
    }
  });
}

export function WritingIndexPage() {
  useSEO({
    title: 'Writings & notes — Shubham Katta',
    description:
      'Essays, technical deep-dives on Claude Code, MCP, prompt engineering, evals, token optimization, and observations on systems and people.',
    keywords:
      'Claude Code, AI engineering, MCP, prompt engineering, evals, token optimization, Anthropic, agents, skills, plugins',
    url: `${SITE_ORIGIN}/writing`,
  });
  return (
    <main className="container page-space">
      <div className="section-head with-badge">
        <div>
          <SectionLabel>writings & notes</SectionLabel>
          <h1 style={{ fontSize: 'clamp(1.35rem, 4vw, 2.9rem)' }}>Essays, personal journeys, strange realizations, and thoughts that refused to stay private.</h1>
        </div>
        <div className="badge-note">ongoing archive</div>
      </div>
      <div className="writing-top-row">
        <Paper tone="paper-blue" className="side-note">
          <SectionLabel tone="ink">currently thinking about</SectionLabel>
          <p>Incentives, memory, and truths that travel better with a joke nearby.</p>
        </Paper>
        <Paper tone="paper-yellow" className="side-note">
          <SectionLabel tone="ink">not just work</SectionLabel>
          <p>Also: journeys, findings, and notes that asked to be written down.</p>
        </Paper>
      </div>
      <div className="grid-three stretch-top writing-grid">
        {posts.map((post) => <PostCard key={post.slug} post={post} />)}
      </div>
    </main>
  );
}

export function WritingPostPage() {
  const { slug } = useParams();
  const post = posts.find((item) => item.slug === slug);
  const published = post?.date ? new Date(post.date) : null;
  useSEO({
    title: post ? `${post.title} — Shubham Katta` : 'Writing — Shubham Katta',
    description: post?.seoDescription || post?.excerpt,
    keywords: post?.keywords,
    ogImage: post?.cover ? `${SITE_ORIGIN}${post.cover}` : undefined,
    url: post ? `${SITE_ORIGIN}/writing/${post.slug}` : `${SITE_ORIGIN}/writing`,
    type: 'article',
    jsonLd: post
      ? {
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.seoDescription || post.excerpt,
          image: post.cover ? `${SITE_ORIGIN}${post.cover}` : undefined,
          datePublished: published && !isNaN(published) ? published.toISOString() : undefined,
          author: { '@type': 'Person', name: 'Shubham Katta', url: SITE_ORIGIN },
          publisher: { '@type': 'Person', name: 'Shubham Katta', url: SITE_ORIGIN },
          mainEntityOfPage: `${SITE_ORIGIN}/writing/${post.slug}`,
          keywords: post.keywords,
        }
      : undefined,
  });
  if (!post) return <main className="container page-space"><Paper><h1>Not found</h1></Paper></main>;

  return (
    <main className="container page-space article-wrap">
      <Paper tone="paper-white">
        {post.cover && <img className="article-cover" src={post.cover} alt={post.title} />}
        <SectionLabel>{post.type}</SectionLabel>
        <h1>{post.title}</h1>
        <div className="article-meta">
          {post.date}
          {post.readingTime ? <span className="meta-dot">·</span> : null}
          {post.readingTime ? <span>{post.readingTime} read</span> : null}
        </div>
        {post.tags?.length ? (
          <div className="article-tags">
            {post.tags.map((tag) => <span key={tag} className="tag-pill">{tag}</span>)}
          </div>
        ) : null}
        <RichText text={post.intro} className="lead" />
        {post.sections.map((section) => (
          <section key={section.heading} className="article-section">
            <h2>{section.heading}</h2>
            <RichText text={section.body} />
          </section>
        ))}
        <Link to="/writing" className="text-link">← back to all writings</Link>
      </Paper>
    </main>
  );
}
