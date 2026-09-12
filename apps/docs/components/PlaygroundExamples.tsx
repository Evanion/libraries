'use client';

import { useState } from 'react';
import WidgetPlayground from './WidgetPlayground';
import { examples } from './playground-examples';

/**
 * A tab strip over {@link examples}, feeding the selected snippet to one
 * WidgetPlayground. Usable as a JSX tag in any MDX page through the map in
 * mdx-components.js.
 */
export default function PlaygroundExamples() {
  const [selectedExample, setSelectedExample] =
    useState<keyof typeof examples>('basic');

  return (
    <div className="playground-examples">
      <div className="examples-header">
        <h3>Try These Examples</h3>
        <div className="example-tabs">
          {Object.entries(examples).map(([key, example]) => (
            <button
              key={key}
              className={`example-tab ${
                selectedExample === key ? 'active' : ''
              }`}
              onClick={() => setSelectedExample(key as keyof typeof examples)}
            >
              {example.title}
            </button>
          ))}
        </div>
      </div>

      <WidgetPlayground
        initialCode={examples[selectedExample].code}
        height={500}
      />
    </div>
  );
}
