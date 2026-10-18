'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';
import './primitives.css';

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
  const still = usePrefersReducedMotion();
  const [played, setIndex] = useState(0);
  const index = still ? frames.length - 1 : played;
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (still || played >= frames.length - 1) return;
    const timer = setTimeout(() => setIndex((i) => i + 1), interval);
    return () => clearTimeout(timer);
  }, [still, played, frames.length, interval, run]);

  return (
    <figure className="replay-frame">
      <figcaption className="replay-frame__bar">{title}</figcaption>
      <div className="replay-frame__view">{frames[index]}</div>
      {!still && frames.length > 1 && (
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
