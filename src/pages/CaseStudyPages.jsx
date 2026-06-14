import { Link, useParams } from 'react-router-dom';
import { caseStudies } from '../content/caseStudies';
import { CaseCard, Paper, SectionLabel } from '../components/Shared';
import { useSEO, SITE_ORIGIN } from '../components/useSEO';

export function CaseStudiesPage() {
  useSEO({
    title: 'Case files — Shubham Katta',
    description:
      'Detailed situations where technical problems were never only technical — domain theft, partner disputes, and the human stakes behind the systems.',
    keywords: 'Shubham Katta, case studies, case files, domain theft, business continuity, technical problem solving',
    url: `${SITE_ORIGIN}/case-studies`,
  });
  return (
    <main className="container page-space">
      <div className="section-head">
        <div>
          <SectionLabel tone="sky">case files</SectionLabel>
          <h1 style={{ fontSize: 'clamp(1.35rem, 4vw, 2.9rem)' }}>Detailed situations where technical problems were never only technical.</h1>
        </div>
      </div>
      <div className="grid-two">
        {caseStudies.map((item) => <CaseCard key={item.slug} item={item} />)}
      </div>
    </main>
  );
}

export function CaseStudyPage() {
  const { slug } = useParams();
  const item = caseStudies.find((entry) => entry.slug === slug);
  useSEO({
    title: item ? `${item.title} — Shubham Katta` : 'Case study — Shubham Katta',
    description: item?.summary || item?.intro,
    keywords: 'Shubham Katta, case study, case files',
    url: item ? `${SITE_ORIGIN}/case-studies/${item.slug}` : `${SITE_ORIGIN}/case-studies`,
    type: 'article',
  });
  if (!item) return <main className="container page-space"><Paper><h1>Not found</h1></Paper></main>;
  return (
    <main className="container page-space article-wrap">
      <Paper tone="paper-white">
        <SectionLabel tone="sky">case study</SectionLabel>
        <h1>{item.title}</h1>
        <p className="lead">{item.intro}</p>
        {item.sections.map((section) => (
          <section key={section.heading} className="article-section">
            <h2>{section.heading}</h2>
            <p>{section.body}</p>
          </section>
        ))}
        <Link to="/case-studies" className="text-link">← back to case files</Link>
      </Paper>
    </main>
  );
}
