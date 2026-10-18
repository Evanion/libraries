'use client';
import { ReplayFrame } from '../primitives/ReplayFrame';
import { usePrefersReducedMotion } from '../primitives/usePrefersReducedMotion';
import { finalPaint, firstPaint } from './no-flicker';

function Checkout({ kind }: { kind: 'old' | 'new' }) {
  return (
    <div className="no-flicker-demo__card" data-kind={kind}>
      {kind === 'new' ? 'New checkout' : 'Old checkout'}
    </div>
  );
}

/** Two checkouts loading side by side: one decided after load, one decided on the server and adopted. */
export default function NoFlickerDemo() {
  const still = usePrefersReducedMotion();
  return (
    <div className="no-flicker-demo">
      <div>
        <ReplayFrame
          title="Decided in the browser after load (a typical setup)"
          frames={
            still
              ? [
                  <div key="both" className="no-flicker-demo__pair">
                    <Checkout kind={firstPaint('client-only')} />
                    <span aria-hidden="true">→</span>
                    <Checkout kind={finalPaint()} />
                  </div>,
                ]
              : [
                  <Checkout key="first" kind={firstPaint('client-only')} />,
                  <Checkout key="last" kind={finalPaint()} />,
                ]
          }
          interval={900}
          replayLabel="Replay"
        />
        <p>Simulation of a page that waits for the browser to decide.</p>
        {still && <p>Old checkout first, swapped after load</p>}
      </div>
      <ReplayFrame
        title="Decided on the server, adopted by the browser"
        frames={[<Checkout key="only" kind={firstPaint('adopted')} />]}
        interval={900}
        replayLabel="Replay"
      />
    </div>
  );
}
