# @evanion/react-feature examples

The documentation site renders these blocks by region, and each one runs as a test of this package.

## The Provider and the Hooks

<!-- #region react-provider -->

```tsx @import.meta.vitest
/** @jsxRuntime classic */
import * as React from 'react';
// ---cut---
import { createFeatures } from '@evanion/feature';
import { FeatureProvider, useFeatureEnabled } from '@evanion/react-feature';
import { renderToStaticMarkup } from 'react-dom/server';

const features = createFeatures([{ key: 'express-pickup', enabled: true }]);
const context = {
  targetingKey: 'cust-0042',
  now: new Date('2026-11-01T00:00:00Z'),
};

function Checkout() {
  if (!useFeatureEnabled('express-pickup')) return <p>Standard checkout</p>;
  return <p>Checkout with express pickup</p>;
}

const html = renderToStaticMarkup(
  <FeatureProvider features={features} context={context}>
    <Checkout />
  </FeatureProvider>,
);

html; // -> '<p>Checkout with express pickup</p>'
```

<!-- #endregion react-provider -->

<!-- #region react-memo -->

```tsx @import.meta.vitest
/** @jsxRuntime classic */
import * as React from 'react';
import { createFeatures } from '@evanion/feature';
import { FeatureProvider, useFeatureEnabled } from '@evanion/react-feature';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const features = createFeatures([{ key: 'express-pickup', enabled: true }]);

function Checkout() {
  return <p>{useFeatureEnabled('express-pickup') ? 'Express' : 'Standard'}</p>;
}
// ---cut---
// The instant the server rendered at, so both sides read the same clock.
const now = new Date('2026-11-01T00:00:00Z');

function Flags({
  customerId,
  children,
}: {
  customerId: string;
  children: ReactNode;
}) {
  const context = useMemo(
    () => ({ targetingKey: customerId, now }),
    [customerId],
  );

  return (
    <FeatureProvider features={features} context={context}>
      {children}
    </FeatureProvider>
  );
}

const html = renderToStaticMarkup(
  <Flags customerId="cust-0042">
    <Checkout />
  </Flags>,
);

html; // -> '<p>Express</p>'
```

<!-- #endregion react-memo -->

<!-- #region react-strict-key -->

```tsx @import.meta.vitest
/** @jsxRuntime classic */
import * as React from 'react';
// ---cut---
import { createFeatures } from '@evanion/feature';
import { FeatureProvider, useFeature } from '@evanion/react-feature';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const features = createFeatures([{ key: 'express-pickup', enabled: true }]);

function Misspelled() {
  return <p>{useFeature('express-delivery').reason}</p>;
}

const attempt = (element: ReactElement) => {
  try {
    return renderToStaticMarkup(element);
  } catch (error) {
    return String(error);
  }
};

const page = (
  <FeatureProvider features={features}>
    <Misspelled />
  </FeatureProvider>
);

attempt(page); // -> 'Error: feature "express-delivery" is not configured in this <FeatureProvider>'
// @ts-expect-error -- the store's keys are checked at compile time
features.isEnabled('express-delivery'); // -> false
```

<!-- #endregion react-strict-key -->

<!-- #region react-decisions -->

```tsx @import.meta.vitest
/** @jsxRuntime classic */
import * as React from 'react';
import { createFeatures } from '@evanion/feature';
import { FeatureProvider, useFeatureEnabled } from '@evanion/react-feature';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const attempt = (element: ReactElement) => {
  try {
    return renderToStaticMarkup(element);
  } catch (error) {
    return String(error);
  }
};
// ---cut---
const features = createFeatures([
  { key: 'express-pickup', enabled: true },
  { key: 'gift-cards', enabled: true },
]);

function Checkout() {
  return <p>{useFeatureEnabled('express-pickup') ? 'Express' : 'Standard'}</p>;
}

const fromServer = features.snapshot();
fromServer.decisions['express-pickup'] = {
  key: 'express-pickup',
  enabled: false,
  reason: 'explicitly-off',
};
// A set shipped as JSON reaches the provider unchecked.
const snapshot = JSON.parse(
  JSON.stringify({
    ...fromServer,
    decisions: { 'gift-cards': fromServer.decisions['gift-cards'] },
  }),
);

const served = (
  <FeatureProvider features={features} decisions={fromServer}>
    <Checkout />
  </FeatureProvider>
);
const partial = (
  <FeatureProvider features={features} decisions={snapshot}>
    <Checkout />
  </FeatureProvider>
);

attempt(served); // -> '<p>Standard</p>'
attempt(partial); // -> 'Error: feature "express-pickup" is not configured in this <FeatureProvider>'
```

<!-- #endregion react-decisions -->

<!-- #region react-bound -->

```tsx @import.meta.vitest
/** @jsxRuntime classic */
import * as React from 'react';
// ---cut---
import { createFeatures } from '@evanion/feature';
import { createFeatureContext } from '@evanion/react-feature';
import { renderToStaticMarkup } from 'react-dom/server';

const features = createFeatures([
  {
    key: 'checkout-cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50, value: { label: 'Get it' } },
    ],
  },
]);

const { FeatureProvider, useVariant } = createFeatureContext(features);

function Cta() {
  const { value } = useVariant('checkout-cta');
  return <button type="button">{value?.label ?? 'Buy'}</button>;
}

function Misspelled() {
  // @ts-expect-error -- 'checkout-button' is not a key of this store
  return <p>{useVariant('checkout-button').variant}</p>;
}

const forCustomer = (targetingKey: string) =>
  renderToStaticMarkup(
    <FeatureProvider context={{ targetingKey }}>
      <Cta />
    </FeatureProvider>,
  );

forCustomer('cust-0199'); // -> '<button type="button">Get it</button>'
forCustomer('cust-0042'); // -> '<button type="button">Buy</button>'
```

<!-- #endregion react-bound -->

<!-- #region react-server -->

```tsx @import.meta.vitest
/** @jsxRuntime classic */
import * as React from 'react';
import { createFeatures } from '@evanion/feature';
import type { DecisionSet } from '@evanion/feature';
import { FeatureProvider, useFeatureEnabled } from '@evanion/react-feature';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

function Checkout() {
  return <p>{useFeatureEnabled('express-pickup') ? 'Express' : 'Standard'}</p>;
}
// ---cut---
const features = createFeatures([
  {
    key: 'express-pickup',
    enabled: true,
    rules: [{ id: 'a-share', rollout: { percent: 25 } }],
  },
]);
type ShopDecisions = DecisionSet<{ 'express-pickup': never }>;

// app/flags.tsx, a client module ('use client')
function Flags({
  decisions,
  children,
}: {
  decisions: ShopDecisions;
  children: ReactNode;
}) {
  return (
    <FeatureProvider features={features} decisions={decisions}>
      {children}
    </FeatureProvider>
  );
}

// app/layout.tsx, a Server Component
function Layout({
  customerId,
  children,
}: {
  customerId: string;
  children: ReactNode;
}) {
  const decisions = features.snapshot({ targetingKey: customerId });

  // The framework serialises this prop on its way into the client module.
  // React's flight serializer and Astro's `devalue` carry the `Date` a window
  // condition's `failed.value` can hold, and `JSON.stringify` by hand sends a
  // string in its place.
  return <Flags decisions={decisions}>{children}</Flags>;
}

const forCustomer = (customerId: string) =>
  renderToStaticMarkup(
    <Layout customerId={customerId}>
      <Checkout />
    </Layout>,
  );

forCustomer('cust-0042'); // -> '<p>Express</p>'
forCustomer('cust-0107'); // -> '<p>Standard</p>'
```

<!-- #endregion react-server -->

## Recording an Exposure

<!-- #region observe-exposure -->

```tsx @import.meta.vitest
/** @jsxRuntime classic */
import * as React from 'react';
// ---cut---
import { createFeatures } from '@evanion/feature';
import { createFeatureContext } from '@evanion/react-feature';
import { useEffect } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const features = createFeatures([
  {
    key: 'checkout-cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50, value: { label: 'Get it' } },
    ],
  },
]);
const { FeatureProvider, useFeature } = createFeatureContext(features);

const exposures: object[] = [];
const analytics = {
  exposure: (record: object) => {
    exposures.push(record);
  },
};

// components/cta.tsx, a client module ('use client')
function Cta({ customerId }: { customerId: string }) {
  const decision = useFeature('checkout-cta');

  useEffect(() => {
    analytics.exposure({
      feature: 'checkout-cta',
      variant: decision.variant,
      source: decision.assignment?.source,
      bucket: decision.assignment?.bucket,
      rule: decision.rule,
      subject: customerId,
    });
  }, [decision, customerId]);

  return <button type="button">{decision.value?.label ?? 'Buy'}</button>;
}

// app/page.tsx, a Server Component
function Page({ customerId }: { customerId: string }) {
  const decisions = features.snapshot({ targetingKey: customerId });

  return (
    <FeatureProvider decisions={decisions}>
      <Cta customerId={customerId} />
    </FeatureProvider>
  );
}

const html = renderToStaticMarkup(<Page customerId="cust-0199" />);

html; // -> '<button type="button">Get it</button>'
exposures; // -> []
```

<!-- #endregion observe-exposure -->
