import { useEffect, useRef, useState } from 'react';

// Cal.com inline embed.
// Default link is the real 15-min event. Override via the `calLink` prop if needed.
// Format: '<username>/<event-slug>' (no leading "https://cal.com/").

const DEFAULT_CAL_LINK = 'shubham-katta-cdzvpk/15min';

function currentTheme() {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function CalEmbed({
  calLink = DEFAULT_CAL_LINK,
  namespace = 'sk-cal',
  layout = 'month_view',
  height = 640,
}) {
  const elementId = `cal-inline-${namespace}`;
  const containerRef = useRef(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;
    let renderPoll;

    function bootstrap() {
      // Cal.com embed bootstrap, idempotent across mounts.
      (function (C, A, L) {
        let p = function (a, ar) { a.q.push(ar); };
        let d = C.document;
        C.Cal = C.Cal || function () {
          let cal = C.Cal;
          let ar = arguments;
          if (!cal.loaded) {
            cal.ns = {};
            cal.q = cal.q || [];
            d.head.appendChild(d.createElement('script')).src = A;
            cal.loaded = true;
          }
          if (ar[0] === L) {
            const api = function () { p(api, arguments); };
            const ns = ar[1];
            api.q = api.q || [];
            if (typeof ns === 'string') {
              cal.ns[ns] = cal.ns[ns] || api;
              p(cal.ns[ns], ar);
              p(cal, ['initNamespace', ns]);
            } else {
              p(cal, ar);
            }
            return;
          }
          p(cal, ar);
        };
      })(window, 'https://app.cal.com/embed/embed.js', 'Cal');
    }

    function init() {
      try {
        bootstrap();
        const theme = currentTheme();
        window.Cal('init', namespace, { origin: 'https://cal.com' });
        window.Cal.ns[namespace]('inline', {
          elementOrSelector: `#${elementId}`,
          config: { layout, theme },
          calLink,
        });
        window.Cal.ns[namespace]('ui', {
          theme,
          hideEventTypeDetails: false,
          layout,
          styles: { branding: { brandColor: '#ff6b6b' } },
        });
        // Poll for the iframe rendering. If it shows up, we're ready.
        renderPoll = window.setInterval(() => {
          if (cancelled) return;
          if (containerRef.current && containerRef.current.querySelector('iframe')) {
            window.clearInterval(renderPoll);
            setStatus('ready');
          }
        }, 200);
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    const tStart = window.setTimeout(init, 50);
    // Fail-safe: if no iframe shows up in 6s, fall back to the link.
    const tBail = window.setTimeout(() => {
      if (cancelled) return;
      if (containerRef.current && !containerRef.current.querySelector('iframe')) {
        setStatus('error');
      }
    }, 6000);

    // Resync the cal theme when the site theme toggles.
    const observer = new MutationObserver(() => {
      try {
        const theme = currentTheme();
        if (window.Cal && window.Cal.ns && window.Cal.ns[namespace]) {
          window.Cal.ns[namespace]('ui', {
            theme,
            hideEventTypeDetails: false,
            layout,
            styles: { branding: { brandColor: '#ff6b6b' } },
          });
        }
      } catch {
        /* swallow */
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
      cancelled = true;
      window.clearTimeout(tStart);
      window.clearTimeout(tBail);
      if (renderPoll) window.clearInterval(renderPoll);
      observer.disconnect();
    };
  }, [calLink, namespace, layout, elementId]);

  return (
    <div className="cal-embed-wrap" aria-label="Schedule a 15-minute conversation">
      <div
        id={elementId}
        ref={containerRef}
        style={{ width: '100%', minHeight: height, overflow: 'auto' }}
      />
      {status === 'error' && (
        <div className="cal-fallback">
          The inline calendar didn't load.{' '}
          <a href={`https://cal.com/${calLink}`} target="_blank" rel="noopener noreferrer">
            Open the booking page directly →
          </a>
        </div>
      )}
    </div>
  );
}
