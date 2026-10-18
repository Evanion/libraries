'use client';
import { useState } from 'react';
import { DecisionTree } from '../primitives/DecisionTree';
import { labelOf, preview, tree } from './cascade';

/** Switch the new checkout off and see, before confirming, what goes with it. */
export default function CascadeDemo() {
  const [checkoutOn, setCheckoutOn] = useState(true);
  const [asking, setAsking] = useState(false);

  return (
    <div className="cascade-demo">
      <button
        type="button"
        onClick={() => (checkoutOn ? setAsking(true) : setCheckoutOn(true))}
      >
        {checkoutOn ? 'Switch new checkout off' : 'Switch new checkout on'}
      </button>
      {asking && (
        <div role="dialog" aria-label="Confirm">
          <p>
            Switching it off also turns off:{' '}
            {preview(true)
              .map((key) => labelOf(key))
              .join(', ')}
            .
          </p>
          <button
            type="button"
            onClick={() => {
              setCheckoutOn(false);
              setAsking(false);
            }}
          >
            Switch off
          </button>
          <button type="button" onClick={() => setAsking(false)}>
            Cancel
          </button>
        </div>
      )}
      <DecisionTree root={tree(checkoutOn)} label="Features" />
    </div>
  );
}
