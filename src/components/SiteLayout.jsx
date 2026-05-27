import { NavLink, Outlet } from 'react-router-dom';
import { site } from '../content/site';
import { ThemeToggle } from './ThemeToggle';

const links = [
  ['Home', '/'],
  ['Me', '/about'],
  ['Work', '/work'],
  ['Writings', '/writing'],
  ['Now', '/now'],
  ['Say hello', '/contact'],
];

export function SiteLayout() {
  return (
    <div className="page-shell">
      <div className="bg-orb orb-a" />
      <div className="bg-orb orb-b" />
      <div className="bg-orb orb-c" />
      <header className="site-header">
        <div className="container header-row">
          <NavLink to="/" className="brand">
            shubhamkatta<span>.</span>com
          </NavLink>
          <nav className="desktop-nav">
            {links.map(([label, href]) => (
              <NavLink
                key={href}
                to={href}
                className={`nav-link${href === '/now' ? ' nav-link-highlight' : ''}`}
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <ThemeToggle />
        </div>
      </header>
      <Outlet />
      <footer className="site-footer">
        <div className="container footer-row">
          <div>© 2026 Shubham Katta · still figuring things out, just with better tools now</div>
          <div className="footer-links">
            <NavLink to="/writing">Writings</NavLink>
            <NavLink to="/now" className="footer-link-highlight">Now</NavLink>
            {/* <NavLink to="/uses">Uses</NavLink> — held back */}
            <NavLink to="/case-studies">Case Files</NavLink>
            <NavLink to="/work">Work</NavLink>
            <a href={site.linkedin}>LinkedIn</a>
            <a href={`mailto:${site.email}`}>Email</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
