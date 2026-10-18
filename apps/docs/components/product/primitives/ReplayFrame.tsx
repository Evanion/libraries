'use client';
import { useEffect, useState, type ReactNode } from 'react';
import './primitives.css';

function reducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

/** A small browser frame that plays its frames in order, with a Replay button. Under reduced motion it shows the last frame. */
export function ReplayFrame({
  title,
  frames,
  interval,
  replayLabel,
}: {
  title: string;
  frames: ReactNode[];
  interval: number;
  replayLabel: string;
}) {
  const [still] = useState(reducedMotion);
  const [index, setIndex] = useState(still ? frames.length - 1 : 0);
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (still || index >= frames.length - 1) return;
    const timer = setTimeout(() => setIndex((i) => i + 1), interval);
    return () => clearTimeout(timer);
  }, [still, index, frames.length, interval, run]);

  return (
    <figure className="replay-frame">
      <figcaption className="replay-frame__bar">{title}</figcaption>
      <div className="replay-frame__view">{frames[index]}</div>
      {!still && (
        <button
          type="button"
          className="replay-frame__replay"
          onClick={() => {
            setIndex(0);
            setRun((r) => r + 1);
          }}
        >
          {replayLabel}
        </button>
      )}
    </figure>
  );
}
