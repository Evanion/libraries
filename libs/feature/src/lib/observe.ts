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
 * The deeply readonly form of `T` for a store that freezes what it answers, and
 * `T` itself for a store that freezes nothing.
 *
 * `Frozen` is naked, so a store whose observation the compiler cannot settle
 * distributes to the union of both forms and a reader narrows it.
 */
export type FrozenWhenObserved<Frozen extends boolean, T> = Frozen extends true
  ? DeepReadonly<T>
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
   * handler to anything thenable and moves on. The engine's own guard stays
   * within run-to-run noise of the bare call, measured at forty features, so
   * the number anyone should care about is what their own hook body does.
   *
   * This member does not count exposures. `resolve` decides every configured
   * feature, so an observer fired from it reports a decision for every feature
   * the request never rendered, and an experiment computed over those records
   * measures the wrong denominator. The numbers look plausible and are wrong.
   * The application writes an exposure record at its render site, off the
   * `variant`, `assignment.source`, `assignment.bucket` and `rule` fields the
   * decision it already holds carries.
   *
   * An event in flight is lost at exit. The engine awaits nothing, so a promise
   * it never awaited and a buffer the application has not drained are both gone
   * when the process exits, and a phone's operating system suspends a process
   * without warning. The observer pushes onto a buffer synchronously and
   * returns, and the application drains that buffer on `SIGTERM` and on the
   * background transition.
   */
  observe?: (event: FeatureEvent<S>) => void | Promise<unknown>;
  /**
   * Reports an observer that threw or rejected. Replaces the default warning.
   *
   * The engine calls this inside the same catch that swallowed the failure. If
   * this handler itself throws, or returns a promise that rejects, the engine
   * reports that through the warning and does not call this handler again for
   * that event. One level of recovery, no recursion.
   *
   * An application that configures `observe` but not this member gets a failure
   * caught and warned once in development. The warning stays silent when
   * `NODE_ENV` is `production`.
   */
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
 * The options of a call that provably installs no observer.
 *
 * `FeatureOptions` declares `observe` optionally, so an argument that carries
 * an observer and an argument that carries none both satisfy it. This form
 * pins the member to `undefined`, so only an argument whose type proves the
 * absence satisfies it.
 *
 * The distinction decides which store a call answers, and the answer leans one
 * way when the compiler cannot settle it. A call whose options satisfy this
 * type answers the mutable form, and every other call answers the frozen form.
 * An options value typed `FeatureOptions<S>`, and an object literal whose
 * `observe` field holds `Fn | undefined`, both fail this type, so both answer
 * the frozen form. The compiler then refuses a write the runtime would refuse
 * too. The opposite lean lets the compiler accept a write that throws.
 */
export type UnobservedOptions<
  S extends Record<keyof S, VariantInfo | never> = Record<
    FeatureKey,
    VariantInfo | never
  >,
> = FeatureOptions<S> & { observe?: undefined };

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
 * Reads the text a failure is keyed on.
 *
 * An `Error` supplies its message, so two distinct failures warn separately and
 * a transport that fails the same way on every call warns once. Any other value
 * goes through `String`. Both reads sit inside the same `try`. An `Error`
 * subclass may compute `message` in a getter that throws, and `String` throws
 * for an object that carries no `toString`. This function catches either and
 * keys the failure on one fixed text.
 */
function keyOf(error: unknown): string {
  try {
    if (error instanceof Error) return error.message;
    return String(error);
  } catch {
    return '[an error with no text]';
  }
}

/** The default warning when the application installed no `onObserveError`. */
const OBSERVER_FAILED =
  '@evanion/feature: an observer failed. Pass onObserveError to handle this and replace this warning.';

/** The warning when the application's `onObserveError` threw. */
const HANDLER_FAILED =
  '@evanion/feature: onObserveError threw. The engine reports the failure here and does not call onObserveError again for this event.';

/** How many distinct failures one emitter warns about. */
const WARN_LIMIT = 20;

/** The last warning an emitter writes, once it has warned {@link WARN_LIMIT} times. */
const WARN_LIMIT_REACHED = `@evanion/feature: an observer has now failed in ${WARN_LIMIT} distinct ways. The engine stops warning about this emitter. Pass onObserveError to receive every failure.`;

/**
 * Builds the function an entry point calls to report what it returned.
 *
 * The returned function calls the installed observer and returns. It never
 * awaits the observer, and an observer that throws or rejects reaches
 * `onObserveError`, or a `console.warn` when the application installed no
 * handler. An `onObserveError` that throws reaches the same warning, which
 * carries the handler's error and the observer's error, and the engine does not
 * call the handler again for that event. The caller keeps the value the entry
 * point computed on every one of those paths.
 *
 * Each emitter carries its own set of warned failures, keyed on the notice and
 * the failing error's message. A transport that fails the same way on every
 * call warns once, and a second, unrelated failure still reaches the log. One
 * process holds one emitter per engine, and no test resets module state to stay
 * order-independent.
 *
 * The set holds at most {@link WARN_LIMIT} keys. An application's transport may
 * stamp a request identifier into the text it throws, which makes every failure
 * a distinct key, so the emitter writes one last warning at the limit and stays
 * silent from then on. `onObserveError` still receives every failure, and the
 * emitter keeps no key for a failure it did not warn about.
 *
 * The warning stays silent when `NODE_ENV` is `production`, which
 * `libs/widget/src/warn.ts` does for the same reason. A runtime that defines no
 * `process` global, such as a browser loading this package as unbundled ESM,
 * warns.
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

  const warned = new Set<string>();
  let capped = false;
  const warn = (notice: string, error: unknown, ...details: unknown[]) => {
    if (
      typeof process !== 'undefined' &&
      process.env?.NODE_ENV === 'production'
    )
      return;
    if (capped) return;
    const key = `${notice}\n${keyOf(error)}`;
    if (warned.has(key)) return;
    if (warned.size >= WARN_LIMIT) {
      capped = true;
      console.warn(WARN_LIMIT_REACHED);
      return;
    }
    warned.add(key);
    console.warn(notice, error, ...details);
  };

  const report = (error: unknown, event: FeatureEvent<S>) => {
    const handler = options.onObserveError;
    if (!handler) {
      warn(OBSERVER_FAILED, error);
      return;
    }
    try {
      const returned = handler(error, event);
      if (isThenable(returned)) {
        returned.then(undefined, (handlerError: unknown) => {
          warn(HANDLER_FAILED, handlerError, error);
        });
      }
    } catch (handlerError) {
      warn(HANDLER_FAILED, handlerError, error);
    }
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
