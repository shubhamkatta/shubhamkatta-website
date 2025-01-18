import { Link } from 'react-router-dom';

export function SectionLabel({ children, tone = 'coral' }) {
  return <p className={`section-label tone-${tone}`}>{children}</p>;
}

export function Paper({ children, className = '', tone = 'paper-white' }) {
  return <div className={`paper ${tone} ${className}`.trim()}>{children}</div>;
}

export function Chip({ children, tone = 'paper-white' }) {
  return <span className={`chip ${tone}`}>{children}</span>;
}

export function PostCard({ post }) {
  return (
    <article className={`paper ${post.color || 'paper-white'} tilt-card`}>
      {post.cover && <img className="post-cover" src={post.cover} alt={post.title} />}
      <div className="post-type">{post.type}</div>
      <h3>{post.title}</h3>
      <p>{post.excerpt || post.body}</p>
      <Link to={`/writing/${post.slug}`} className="text-link">
        read this →
      </Link>
    </article>
  );
}

export function CaseCard({ item }) {
  return (
    <article className="paper paper-white case-card">
      <h3>{item.title}</h3>
      <p>{item.summary}</p>
      <Link to={`/case-studies/${item.slug}`} className="text-link">
        read case file →
      </Link>
    </article>
  );
}
