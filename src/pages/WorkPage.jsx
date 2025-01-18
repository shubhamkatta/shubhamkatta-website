import { roles, metrics } from '../content/site';
import { Paper, SectionLabel } from '../components/Shared';

export function WorkPage() {
  return (
    <main className="container page-space">
      <Paper tone="paper-white">
        <SectionLabel tone="sky">work</SectionLabel>
        <h1 style={{ fontSize: 'clamp(1.35rem, 4vw, 2.9rem)' }}>The professional chapter. Important, but not the whole autobiography.</h1>
      </Paper>
      <div className="split-grid work-grid page-space-small">
        <div className="stack-list">
          {roles.map((role) => (
            <Paper key={role.company} tone={role.color}>
              <div className="role-head">
                <h2>{role.company}</h2>
                <span className="date-pill">{role.period}</span>
              </div>
              <div className="role-title">{role.title}</div>
              <p>{role.note}</p>
              <div className="tag-row">
                {role.tags.map((tag) => <span key={tag} className="tag-pill">{tag}</span>)}
              </div>
            </Paper>
          ))}
        </div>
        <Paper tone="paper-yellow">
          <SectionLabel tone="ink">quick numbers</SectionLabel>
          {metrics.map(([value, label]) => (
            <div key={value} className="metric-row">
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </Paper>
      </div>
    </main>
  );
}
