'use client';
import { useMemo, useState } from 'react';
import { CodeView } from '../primitives/CodeView';
import { VisitorCrowd, type CrowdMember } from '../primitives/VisitorCrowd';
import { Scrubber } from '../primitives/Scrubber';
import { assign, moved, visitors } from './variants';

/** A two-way split over the demo crowd: move the split and see who switches, pin a group to one side. */
export default function VariantsDemo() {
  const [weight, setWeight] = useState(50);
  const [previous, setPrevious] = useState<Record<string, string> | null>(null);
  const [pinned, setPinned] = useState(false);
  const [touched, setTouched] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  const variants = useMemo(() => assign(weight, pinned), [weight, pinned]);
  const switched = useMemo(
    () => new Set(previous ? moved(previous, variants) : []),
    [previous, variants],
  );

  const members: CrowdMember[] = visitors.map((v) => ({
    id: v.id,
    lit: variants[v.id] === 'blue',
    tone: variants[v.id] === 'blue' ? 'b' : 'a',
    mark:
      pinned && v.bookseller
        ? 'pinned'
        : switched.has(v.id)
          ? 'moved'
          : undefined,
    label: `${v.id}${v.bookseller ? ' (bookseller)' : ''}: ${variants[v.id]}${pinned && v.bookseller ? ', pinned' : ''}${switched.has(v.id) ? ', switched just now' : ''}`,
  }));

  return (
    <div className="variants-demo">
      <CodeView
        label="The document"
        lines={[
          { key: 'open', content: "{ key: 'checkout-cta', enabled: true," },
          {
            key: 'weights',
            lit: touched,
            content: `  variants: [{ name: 'control', weight: ${100 - weight} }, { name: 'blue', weight: ${weight} }],`,
          },
          {
            key: 'pin',
            lit: pinned,
            content: pinned
              ? "  rules: [{ when: [{ field: 'role', op: 'eq', value: 'bookseller' }], variant: 'blue' }, …],"
              : '  rules: [],',
          },
          { key: 'close', content: '}' },
        ]}
      />
      <Scrubber
        label="Share seeing the blue button"
        min={0}
        max={100}
        step={5}
        value={weight}
        format={(v) => `${v}% blue`}
        onChange={(v) => {
          setPrevious(variants);
          setWeight(v);
          setTouched(true);
        }}
      />
      <label>
        <input
          type="checkbox"
          checked={pinned}
          onChange={(e) => {
            setPrevious(variants);
            setPinned(e.currentTarget.checked);
          }}
        />{' '}
        Always show blue to booksellers
      </label>
      <p data-testid="moved" aria-live="polite">
        {previous
          ? `${switched.size} of ${visitors.length} visitors now see a different button`
          : 'Move the split to see who switches'}
      </p>
      <VisitorCrowd
        legend="Each dot is a visitor. Filled ones see the blue button, hollow ones the original. A dashed outline is a bookseller pinned to blue. A ring is a visitor who switched just now."
        count=""
        onFocusMember={setActive}
        members={members}
      />
      <p className="variants-demo__readout" data-testid="readout">
        {active
          ? members.find((m) => m.id === active)?.label
          : 'Tap or hover a dot to see that visitor.'}
      </p>
    </div>
  );
}
