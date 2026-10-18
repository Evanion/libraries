'use client';
import { useState } from 'react';
import { CodeView } from '../primitives/CodeView';
import { Scrubber } from '../primitives/Scrubber';
import { LAUNCH, checkoutAt } from './schedule';

/** The first minute the checkout is on: `after` is strict, so 09:00:00 itself is still off. */
const FIRST_ON_MINUTE = 181;
const LAUNCH_MINUTE = 180;

function clock(minutes: number): string {
  const total = 6 * 60 + minutes;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)} UTC`;
}

/** A clock the reader scrubs past a launch time; the checkout answers from the real library. */
export default function ScheduleDemo() {
  const [minutes, setMinutes] = useState(120);
  const on = checkoutAt(minutes).enabled;

  return (
    <div className="schedule-demo">
      <CodeView
        label="The document"
        lines={[
          { key: 'open', content: 'createFeatures([' },
          { key: 'key', content: "  { key: 'new-checkout', enabled: true," },
          {
            key: 'rule',
            lit: on,
            content: `    rules: [{ when: [{ field: 'now', op: 'after', value: '${LAUNCH}' }] }] },`,
          },
          { key: 'close', content: '])' },
        ]}
      />
      <Scrubber
        label="Time on launch day"
        min={0}
        max={360}
        step={1}
        value={minutes}
        format={clock}
        marks={[
          { value: LAUNCH_MINUTE, label: 'Launch 09:00' },
          { value: FIRST_ON_MINUTE, label: 'On from 09:01' },
        ]}
        onChange={setMinutes}
      />
      <div className="schedule-demo__checkout" data-testid="checkout">
        {on ? 'New checkout' : 'Old checkout'}
      </div>
    </div>
  );
}
