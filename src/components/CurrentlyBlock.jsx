import { useEffect, useState } from 'react';

function formatIST(date) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

export function CurrentlyBlock() {
  const [time, setTime] = useState(() => formatIST(new Date()));

  useEffect(() => {
    const update = () => setTime(formatIST(new Date()));
    update();
    const id = window.setInterval(update, 30 * 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <dl className="currently-block" aria-label="Current status snapshot">
      <div className="currently-row">
        <dt className="currently-label">in</dt>
        <dd className="currently-value">
          Bengaluru, IN · <time dateTime={new Date().toISOString()}>{time} IST</time>
        </dd>
      </div>
      <div className="currently-row">
        <dt className="currently-label">doing</dt>
        <dd className="currently-value">
          <span className="currently-dot" aria-hidden="true" />
          building an AI-native threat intelligence platform
        </dd>
      </div>
      <div className="currently-row">
        <dt className="currently-label">reading</dt>
        <dd className="currently-value">
          <em>The Hard Thing About Hard Things</em> — Ben Horowitz
        </dd>
      </div>
      <div className="currently-row">
        <dt className="currently-label">drinking</dt>
        <dd className="currently-value">tea, coffee, or beer — depending on the hour and the mood</dd>
      </div>
      <div className="currently-row">
        <dt className="currently-label">status</dt>
        <dd className="currently-value">open to selective work</dd>
      </div>
    </dl>
  );
}
