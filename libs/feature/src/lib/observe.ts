import type {
  Decisions,
  FeatureKey,
  Plan,
  ToggleResult,
  VariantInfo,
} from './types.js';

/**
 * A `Date` with its mutators removed.
 *
 * `Readonly<Date>` marks the properties readonly and leaves every `setTime`,
 * `setHours` and `setFullYear` callable, and each of those writes an internal
 * slot that `Object.freeze` does not cover. Every mutator on `Date` starts with
 * `set`, so the template literal names all of them and `Omit` drops them.
 */
export type ReadonlyDate = Omit<Date, `set${string}`>;

/**
 * Every property readonly, through arrays and nested objects.
 *
 * A `Date` becomes a {@link ReadonlyDate}. A function passes through, because
 * mapping over its properties erases the call signature.
 */
export type DeepReadonly<T> = T extends Date
  ? ReadonlyDate
  : T extends (...args: never[]) => unknown
    ? T
    : T extends readonly (infer E)[]
      ? readonly DeepReadonly<E>[]
      : T extends object
        ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
        : T;

/**
 * What an entry point reports after it answered.
 *
 * One event per public call, carrying the value the caller received. `resolve`
 * reports every decision in one event, and no entry point reports one event per
 * feature. An auditor reading a `resolve` event knows the application asked for
 * every feature, and an auditor reading an `is-enabled` event knows it asked for
 * one.
 *
 * Every payload is deeply readonly. An observer reads what the call returned
 * and changes no outcome, and the compiler refuses
 * `event.decisions.cta.enabled = false` for a TypeScript consumer. A JavaScript
 * consumer ignores the type, and the engine freezes what it emits.
 *
 * No event carries an `EvaluationContext`. An event carries the instant the
 * call settled on, the value it returned, and a subject identifier copied out
 * as a primitive.
 */
export type FeatureEvent<
  S extends Record<keyof S, VariantInfo | never> = Record<
    FeatureKey,
    VariantInfo | never
  >,
> =
  | {
      readonly type: 'resolve';
      readonly at: ReadonlyDate;
      readonly decisions: DeepReadonly<Decisions<S>>;
      readonly subject?: string | number;
      readonly version?: string;
    }
  | {
      /**
       * The mapped type distributes over the schema's keys and the union closes
       * over the members it produces, so one member pairs `key: 'cta'` with the
       * decision `'cta'` resolves to. A flat object typing `key` as the union of
       * every key and `decision` as the union of every decision lets a consumer
       * who narrows on `key` read a decision belonging to another feature.
       */
      [K in keyof S & FeatureKey]: {
        readonly type: 'is-enabled';
        readonly at: ReadonlyDate;
        readonly key: K;
        /**
         * The one decision the caller's key resolved to, narrowed by the schema
         * exactly as the matching member of a `resolve` event's `decisions` is.
         */
        readonly decision: DeepReadonly<Decisions<S>[K]>;
        readonly subject?: string | number;
        readonly version?: string;
      };
    }[keyof S & FeatureKey]
  | {
      readonly type: 'plan';
      readonly at: ReadonlyDate;
      readonly plan: DeepReadonly<Plan<S>>;
      readonly subject?: string | number;
      readonly version?: string;
    }
  | {
      readonly type: 'toggle';
      readonly at: ReadonlyDate;
      readonly result: DeepReadonly<ToggleResult<keyof S & FeatureKey>>;
      readonly subject?: string | number;
      readonly version?: string;
    };

/** What an application installs at construction. */
export interface FeatureOptions<
  S extends Record<keyof S, VariantInfo | never> = Record<
    FeatureKey,
    VariantInfo | never
  >,
> {
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

/**
 * Reads whether a value is a thenable.
 *
 * An observer that returns a promise-like object gets a rejection handler. An
 * observer that returns a plain value gets none.
 */
function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

/**
 * Builds the function an entry point calls to report what it returned.
 *
 * The returned function calls the installed observer and returns. It never
 * awaits the observer, and an observer that throws or rejects reaches
 * `onObserveError`, or a single `console.warn` when the application installed
 * no handler. The caller keeps the value the entry point computed either way.
 *
 * Each emitter carries its own warned flag. One process holds one emitter per
 * engine, so a broken transport produces one warning per engine and no test
 * resets module state to stay order-independent.
 */
export function createEmitter<
  S extends Record<keyof S, VariantInfo | never> = Record<
    FeatureKey,
    VariantInfo | never
  >,
>(options: FeatureOptions<S>): (event: FeatureEvent<S>) => void {
  const observe = options.observe;
  if (!observe) {
    return () => {
      // The engine calls this once per entry point call when no observer is
      // installed.
    };
  }

  let warned = false;
  const report = (error: unknown, event: FeatureEvent<S>) => {
    if (options.onObserveError) {
      options.onObserveError(error, event);
      return;
    }
    if (warned) return;
    warned = true;
    console.warn(
      '@evanion/feature: an observer failed. Pass onObserveError to handle this and replace this warning.',
      error,
    );
  };

  return (event) => {
    try {
      const returned = observe(event);
      if (isThenable(returned)) {
        returned.then(undefined, (error: unknown) => {
          report(error, event);
        });
      }
    } catch (error) {
      report(error, event);
    }
  };
}
