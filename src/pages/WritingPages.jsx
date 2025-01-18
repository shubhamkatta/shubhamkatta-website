import { Link, useParams } from 'react-router-dom';
import { posts } from '../content/posts';
import { Paper, PostCard, SectionLabel } from '../components/Shared';

export function WritingIndexPage() {
  return (
    <main className="container page-space">
      <div className="section-head with-badge">
        <div>
          <SectionLabel>writings & notes</SectionLabel>
          <h1 style={{ fontSize: 'clamp(1.35rem, 4vw, 2.9rem)' }}>Essays, personal journeys, strange realizations, and thoughts that refused to stay private.</h1>
        </div>
        <div className="badge-note">ongoing archive</div>
      </div>
      <div className="split-grid">
        <div className="grid-two stretch-top">
          {posts.map((post) => <PostCard key={post.slug} post={post} />)}
        </div>
        <div className="side-stack">
          <Paper tone="paper-blue">
            <SectionLabel tone="ink">currently thinking about</SectionLabel>
            <p>Incentives, performative professionalism, how digital memory works, and why some truths can only be said with a joke nearby.</p>
          </Paper>
          <Paper tone="paper-yellow">
            <SectionLabel tone="ink">not everything here is about work</SectionLabel>
            <p>This archive is also for journeys, personal experiences, casual findings, and whatever kept asking to be written down.</p>
          </Paper>
        </div>
      </div>
    </main>
  );
}

function RichText({ text, className }) {
  const paragraphs = text.split('\n\n');
  return paragraphs.map((para, i) => {
    const trimmed = para.trim();
    // Quote: starts with " and contains closing "
    if (trimmed.startsWith('"') && trimmed.includes('"')) {
      return <blockquote key={i} className="article-quote">{trimmed}</blockquote>;
    }
    // Attribution: starts with – or —
    if (trimmed.startsWith('–') || trimmed.startsWith('—') || trimmed.startsWith('Source:')) {
      return <p key={i} className="article-attribution">{trimmed}</p>;
    }
    return <p key={i} className={className}>{trimmed}</p>;
  });
}

export function WritingPostPage() {
  const { slug } = useParams();
  const post = posts.find((item) => item.slug === slug);
  if (!post) return <main className="container page-space"><Paper><h1>Not found</h1></Paper></main>;

  return (
    <main className="container page-space article-wrap">
      <Paper tone="paper-white">
        {post.cover && <img className="article-cover" src={post.cover} alt={post.title} />}
        <SectionLabel>{post.type}</SectionLabel>
        <h1>{post.title}</h1>
        <div className="article-meta">{post.date}</div>
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
