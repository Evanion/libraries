import type {
  Decision,
  Decisions,
  FeatureKey,
  Plan,
  Schema,
  ToggleResult,
} from './types.js';

/**
 * What an entry point reports after it answered.
 *
 * One event per public call, carrying the value the caller received. `resolve`
 * reports every decision in one event, and no entry point reports one event per
 * feature. An auditor reading a `resolve` event knows the application asked for
 * every feature, and an auditor reading an `is-enabled` event knows it asked for
 * one.
 *
 * No event carries an `EvaluationContext`. An event carries the instant the
 * call settled on, the value it returned, and a subject identifier copied out
 * as a primitive.
 */
export type FeatureEvent<S extends Schema = Schema> =
  | {
      type: 'resolve';
      at: Date;
      decisions: Decisions<S>;
      subject?: string | number;
      version?: string;
    }
  | {
      type: 'is-enabled';
      at: Date;
      key: keyof S & FeatureKey;
      decision: Decision<keyof S & FeatureKey>;
      subject?: string | number;
      version?: string;
    }
  | {
      type: 'plan';
      at: Date;
      plan: Plan<S>;
      subject?: string | number;
      version?: string;
    }
  | {
      type: 'toggle';
      at: Date;
      result: ToggleResult<keyof S & FeatureKey>;
      subject?: string | number;
      version?: string;
    };

/** What an application installs at construction. */
export interface FeatureOptions<S extends Schema = Schema> {
  /**
   * Called once per public entry point call. The engine never awaits it.
   *
   * An observer that blocks turns an observability feature into an availability
   * incident. A decision costs under a microsecond and an audit transport on a
   * bad day costs forty milliseconds, so the engine attaches a rejection
   * handler to anything thenable and moves on.
   */
  observe?: (event: FeatureEvent<S>) => void | Promise<unknown>;
  /** Reports an observer that threw or rejected. Replaces the default warning. */
  onObserveError?: (error: unknown, event: FeatureEvent<S>) => void;
  /**
   * The context field whose value identifies the subject on an event. Defaults
   * to `targetingKey`. An application bucketing on a raw identifier points this
   * at a field carrying a pseudonym.
   */
  correlateBy?: string;
  /** The configuration version an event reports. */
  version?: string;
}
