'use client';
import { useEffect, useRef, useState } from 'react';
import { CodeView } from '../primitives/CodeView';
import { DecisionTree } from '../primitives/DecisionTree';
import { labelOf, preview, tree } from './cascade';

/** Switch the new checkout off and see, before confirming, what goes with it. */
export default function CascadeDemo() {
  const [checkoutOn, setCheckoutOn] = useState(true);
  const [asking, setAsking] = useState(false);
  const [touched, setTouched] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (asking) confirm.current?.focus();
  }, [asking]);

  function close() {
    setAsking(false);
    trigger.current?.focus();
  }

  return (
    <div className="cascade-demo">
      <CodeView
        label="The document"
        lines={[
          { key: 'open', content: 'createFeatures([' },
          {
            key: 'checkout',
            lit: touched,
            content: `  { key: 'new-checkout', enabled: ${checkoutOn} },`,
          },
          {
            key: 'pickup',
            content:
              "  { key: 'express-pickup', enabled: true, dependsOn: ['new-checkout'] },",
          },
          {
            key: 'booking',
            content:
              "  { key: 'demo-night-booking', enabled: true, dependsOn: ['express-pickup'] },",
          },
          { key: 'close', content: '])' },
        ]}
      />
      <button
        ref={trigger}
        type="button"
        className="product-button"
        onClick={() => {
          if (checkoutOn) {
            setAsking(true);
          } else {
            setCheckoutOn(true);
            setTouched(true);
          }
        }}
      >
        {checkoutOn ? 'Switch new checkout off' : 'Switch new checkout on'}
      </button>
      {asking && (
        <div
          role="dialog"
          aria-label="Confirm"
          className="cascade-demo__confirm"
          onKeyDown={(e) => {
            if (e.key === 'Escape') close();
          }}
        >
          <p>
            Switching it off also turns off:{' '}
            {preview(true)
              .map((key) => labelOf(key))
              .join(', ')}
            .
          </p>
          <div className="product-button-row">
            <button
              ref={confirm}
              type="button"
              className="product-button"
              data-primary=""
              onClick={() => {
                setCheckoutOn(false);
                setTouched(true);
                setAsking(false);
                trigger.current?.focus();
              }}
            >
              Switch off
            </button>
            <button type="button" className="product-button" onClick={close}>
              Cancel
            </button>
          </div>
        </div>
      )}
      <DecisionTree root={tree(checkoutOn)} label="Features" />
    </div>
  );
}
