'use client';

import { useId, useMemo, useState } from 'react';
import { FeatureProvider, documented, features, useFeature } from './bound';
import '../demo.css';
import './react-feature-demo.css';

/**
 * What the shop's checkout button renders under the bound provider.
 *
 * One hook call and no props. The button's label is the assigned variant's
 * `value`, and the pairs beside it are the rest of the decision the provider
 * published: which variant, how it was assigned, which bucket the id hashed
 * into and why the feature is on at all.
 */
function Cta() {
  const decision = useFeature('checkout-cta');

  return (
    <div>
      <button type="button" className="react-feature-demo__cta">
        {decision.value?.label ?? 'Buy'}
      </button>
      <dl className="react-feature-demo__pairs">
        <dt>variant</dt>
        <dd>{decision.variant ?? 'none'}</dd>
        <dt>source</dt>
        <dd>{decision.assignment?.source ?? 'none'}</dd>
        <dt>bucket</dt>
        <dd>{decision.assignment?.bucket ?? 'none'}</dd>
        <dt>reason</dt>
        <dd>{decision.reason}</dd>
      </dl>
    </div>
  );
}

/**
 * One bound `FeatureProvider`, with the customer id it resolves for in an
 * input.
 *
 * The claim a variant assignment rests on is invisible in prose: the id decides
 * the variant, the same id comes back the same every time, and a neighbouring
 * id lands anywhere. Retyping the id is what shows it, and the button under the
 * provider re-renders because the provider published a new decision rather than
 * because anything passed it down.
 *
 * `context` goes through `useMemo` for the reason the page states: the provider
 * memoises resolution on that object's identity, so a literal written inline
 * re-resolves the whole store on every keystroke of every parent.
 *
 * `createFeatures` and the hooks are the published packages, reached through
 * the specifiers a consumer writes. Nothing here is a stand-in.
 */
export default function ProviderDemo() {
  const [targetingKey, setTargetingKey] = useState<string>(documented[0]);
  const id = useId();
  const context = useMemo(() => ({ targetingKey }), [targetingKey]);

  return (
    <div className="demo">
      <div className="react-feature-demo__controls">
        <label htmlFor={`${id}-key`} className="demo__legend">
          customer id
        </label>
        <input
          id={`${id}-key`}
          className="react-feature-demo__input"
          value={targetingKey}
          onChange={(event) => setTargetingKey(event.target.value)}
        />
        <p className="react-feature-demo__hint">
          Retype the id. The same customer always gets the same variant, and
          about half of them get <code>blue</code>.
        </p>
      </div>

      <pre className="demo__code">
        <code>{`<FeatureProvider context={{ targetingKey: '${targetingKey}' }}>`}</code>
      </pre>

      <FeatureProvider features={features} context={context}>
        <Cta />
      </FeatureProvider>
    </div>
  );
}
