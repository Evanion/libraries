'use client';

import { useState } from 'react';
import { Button, SectionHeader, Title } from '@evanion/baize-ui';
import WidgetPlayground from './WidgetPlayground';
import { examples } from './playground-examples';

/**
 * A tab strip over {@link examples}, feeding the selected snippet to one
 * WidgetPlayground. Usable as a JSX tag in any MDX page through the map in
 * mdx-components.js.
 *
 * The heading and the buttons are `@evanion/baize-ui`'s. The strip itself is this
 * app's, because a tab set is client state and the library is stateless by rule --
 * the primitives carry the skin and this file carries the `useState`.
 */
export default function PlaygroundExamples() {
  const [selectedExample, setSelectedExample] =
    useState<keyof typeof examples>('basic');

  return (
    <div>
      <SectionHeader
        heading={
          <Title as="h3" size="sm">
            Try these examples
          </Title>
        }
        aside={
          <div className="example-tabs">
            {Object.entries(examples).map(([key, example]) => (
              <Button
                key={key}
                variant={selectedExample === key ? 'standard' : 'quiet'}
                onClick={() => setSelectedExample(key as keyof typeof examples)}
              >
                {example.title}
              </Button>
            ))}
          </div>
        }
      />

      <WidgetPlayground
        initialCode={examples[selectedExample].code}
        height={500}
      />

      <style jsx>{`
        .example-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: var(--baize-space-2);
        }
      `}</style>
    </div>
  );
}
