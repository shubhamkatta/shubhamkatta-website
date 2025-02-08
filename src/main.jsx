import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

// GitHub Pages SPA redirect: recover path from 404.html redirect
const params = new URLSearchParams(window.location.search);
const redirectPath = params.get('p');
if (redirectPath) {
  window.history.replaceState(null, '', redirectPath);
}
import './styles.css';
import { HomePage } from './pages/HomePage';
import { AboutPage } from './pages/AboutPage';
import { WorkPage } from './pages/WorkPage';
import { WritingIndexPage, WritingPostPage } from './pages/WritingPages';
import { CaseStudiesPage, CaseStudyPage } from './pages/CaseStudyPages';
import { ContactPage } from './pages/ContactPage';
import { SiteLayout } from './components/SiteLayout';

const router = createBrowserRouter([
  {
    path: '/',
    element: <SiteLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'work', element: <WorkPage /> },
      { path: 'writing', element: <WritingIndexPage /> },
      { path: 'writing/:slug', element: <WritingPostPage /> },
      { path: 'case-studies', element: <CaseStudiesPage /> },
      { path: 'case-studies/:slug', element: <CaseStudyPage /> },
      { path: 'contact', element: <ContactPage /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
