import { useEffect } from 'react';

export const SITE_ORIGIN = 'https://shubhamkatta.com';

function setMeta(name, content, isProperty = false) {
  const attr = isProperty ? 'property' : 'name';
  let el = document.head.querySelector(`meta[${attr}="${name}"]`);
  if (!content) {
    if (el) el.removeAttribute('content');
    return;
  }
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(url) {
  if (!url) return;
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', url);
}

function setJsonLd(data) {
  const id = 'page-jsonld';
  let el = document.getElementById(id);
  if (!data) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

export function useSEO({ title, description, keywords, ogImage, url, type = 'website', jsonLd }) {
  useEffect(() => {
    const image = ogImage || `${SITE_ORIGIN}/bitmoji-relax.png`;
    if (title) document.title = title;
    setMeta('description', description);
    setMeta('keywords', keywords);
    setMeta('og:title', title, true);
    setMeta('og:description', description, true);
    setMeta('og:type', type, true);
    setMeta('og:image', image, true);
    if (url) setMeta('og:url', url, true);
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', title);
    setMeta('twitter:description', description);
    setMeta('twitter:image', image);
    setCanonical(url);
    setJsonLd(jsonLd);
    return () => setJsonLd(null);
  }, [title, description, keywords, ogImage, url, type, jsonLd]);
}
