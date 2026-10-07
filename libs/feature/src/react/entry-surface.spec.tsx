import { describe, expect, it } from 'vitest';
import * as core from '../index.js';
import * as reactEntry from './index.js';

/**
 * The react entry re-exports the document types and changes no runtime.
 *
 * A type-only re-export erases, so the claim is only checkable against the
 * module namespace a bundler builds. These cases read the key set: the
 * provider, the four hooks and the binder, and no value the core owns. A task
 * that adds a hook to the adapter edits the list in the first case, which is
 * the point of spelling it.
 */

/**
 * Every document type the react entry names, spelled as a value.
 *
 * `export type` erases and `export` does not, so a member of this list
 * appearing on the namespace means the entry started shipping a value under a
 * type's name.
 */
const DOCUMENT_TYPES = [
  'BaseFieldType',
  'ConfigEnvelope',
  'ConfigIssue',
  'ConfigIssueCode',
  'ContextSchema',
  'FeatureConfig',
  'FeatureSchema',
  'FeatureShape',
  'FieldType',
  'JsonValue',
  'ReloadResult',
  'SerializedAttributeCondition',
  'SerializedCondition',
  'SerializedDefinition',
  'SerializedInstant',
  'SerializedRule',
  'SerializedVariantSpec',
  'SerializedWindowCondition',
  'ValidationResult',
  'ValueShape',
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

  it('carries no value under any of the twenty document type names', () => {
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
