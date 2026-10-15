import { describe, expect, it } from 'vitest';
import * as core from '@evanion/feature';
import * as reactEntry from './index.js';

/**
 * The react entry re-exports the document types and changes no runtime.
 *
 * A type-only re-export erases, so the runtime half of the claim is only
 * checkable against the module namespace a bundler builds. These cases read
 * the key set: the provider, the four hooks and the binder, and no value the
 * core owns. A task that adds a hook to the adapter edits the list in the first
 * case, which is the point of spelling it.
 *
 * `tools/repo-checks/src/feature-entry-parity.test.ts` holds the names half,
 * read off both entries' sources, and `config-types.test-d.tsx` holds each
 * name to the core's declaration.
 */

/** The document types the spec's header puts on the package, § header. */
const DOCUMENT_TYPES = [
  'ConfigIssue',
  'ContextSchema',
  'FeatureConfig',
  'FeatureSchema',
  'FeatureShape',
  'ReloadResult',
  'SerializedInstant',
  'ValidationResult',
] as const;

/** The document functions a component file reaches the core entry for. */
const DOCUMENT_FUNCTIONS = [
  'configDigest',
  'parseFeatureConfig',
  'serializeConfig',
  'validateConfig',
] as const;

describe('the react entry at runtime', () => {
  it('exports the provider, the hooks and the binder, and nothing more', () => {
    expect(Object.keys(reactEntry).sort()).toEqual([
      'FeatureProvider',
      'createFeatureContext',
      'useFeature',
      'useFeatureEnabled',
      'useFeatures',
      'useVariant',
    ]);
  });

  it('holds a function at every name it exports, so no document rides along', () => {
    const kinds = Object.values(reactEntry).map((each) => typeof each);

    expect([...new Set(kinds)]).toEqual(['function']);
  });

  it('carries no value under any document type name, because the names erase', () => {
    const leaked = DOCUMENT_TYPES.filter((name) => name in reactEntry);

    expect(leaked).toEqual([]);
  });

  it('leaves the four document functions on the core, which publishes them', () => {
    const published = DOCUMENT_FUNCTIONS.filter((name) => name in core);
    const adapted = DOCUMENT_FUNCTIONS.filter((name) => name in reactEntry);

    expect({ published, adapted }).toEqual({
      published: [...DOCUMENT_FUNCTIONS],
      adapted: [],
    });
  });

  it('adds no name the core entry already publishes', () => {
    const shared = Object.keys(reactEntry).filter((name) => name in core);

    expect(shared).toEqual([]);
  });
});
