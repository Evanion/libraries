import { ActionNotAllowedError } from './errors.js';
import { formatPath, parsePath } from './field-path.js';
import type {
  EvaluationContext,
  FieldConfig,
  FieldDecision,
  FieldOutcome,
  FieldReason,
  FieldRules,
  FieldState,
  Permission,
} from './types.js';

function hasOwn(bag: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(bag, key);
}

/**
 * Writes one own data property, keyed by a field name that comes from data.
 * `__proto__` is a field name like any other here, and plain assignment would
 * hand it to the prototype setter instead of the map.
 */
function put<T>(bag: Record<string, T>, key: string, value: T): void {
  Object.defineProperty(bag, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

/**
 * Whether a token names a field. `*` is the baseline and `!name` an exclusion:
 * authoring syntax that carries no field of its own, wherever it turns up —
 * including as a literal key of the object or of a proposed write.
 *
 * `__proto__` names no field either. `JSON.parse` yields it as an own key, and
 * a decision that carried it would let `pickAllowedFields` hand back a value
 * that `Object.assign` writes through the prototype setter rather than onto the
 * row. A name that cannot survive being applied is not a writable field.
 */
function isFieldName(token: string): boolean {
  return token !== '*' && token !== '__proto__' && !token.startsWith('!');
}

/**
 * The transitions key a stored value names, or undefined when it names none.
 *
 * A state machine is keyed by the strings a serializer produces, so only a
 * primitive names an edge. Every other value — an object, an array, a symbol —
 * is a shape the machine was not written for.
 */
function edgeName(current: unknown): string | undefined {
  switch (typeof current) {
    case 'string':
      return current;
    case 'number':
    case 'boolean':
    case 'bigint':
      return String(current);
    default:
      return current === null ? 'null' : undefined;
  }
}

function nameList(rules: FieldRules): readonly string[] | undefined {
  return rules['fields'] as readonly string[] | undefined;
}

/** One field of the rule tree: what the rules say at a path, and what lies below it. */
interface RuleNode {
  readonly children: Map<string, RuleNode>;
  /** A `!path` entry names this path. */
  excluded: boolean;
  /** A bare `path` entry names this path. */
  listed: boolean;
  /**
   * The rules name this path as a field of its own: a bare entry, a config, or
   * a flat rule key. A top-level exclusion alone names no field.
   */
  named: boolean;
  /** The `targets`/`transitions` config keyed by this path, on the write axis. */
  config?: FieldConfig;
}

/** The rules that apply on one axis, as a tree of paths. */
interface RuleTree {
  readonly root: RuleNode;
  /** The `fields` list carries `*`. */
  readonly star: boolean;
  /** The rules carry a `fields` list, so a field it does not allow is denied. */
  readonly hasList: boolean;
}

function newNode(): RuleNode {
  return {
    children: new Map(),
    excluded: false,
    listed: false,
    named: false,
  };
}

function nodeAt(root: RuleNode, segments: readonly string[]): RuleNode {
  let node = root;
  for (const segment of segments) {
    let child = node.children.get(segment);
    if (!child) {
      child = newNode();
      node.children.set(segment, child);
    }
    node = child;
  }
  return node;
}

/** The segments of a rule path, or undefined when a segment cannot name a field. */
function ruleSegments(path: string): readonly string[] | undefined {
  // A top-level empty key is no path, but it is a field of the flat object.
  const segments = path === '' ? [''] : parsePath(path);
  return segments && segments.every(isFieldName) ? segments : undefined;
}

function isConfig(value: unknown): value is FieldConfig {
  return (
    typeof value === 'object' &&
    value !== null &&
    ('targets' in value || 'transitions' in value)
  );
}

/**
 * The tree of paths the rules name on one axis. The read axis takes list
 * entries only. The write axis also takes `targets`/`transitions` keys.
 *
 * A flat rule key enters the tree on both axes, as a named field does. A rule
 * key below the top level enters it only as a write config, because only a
 * write config applies there.
 */
function buildRuleTree(rules: FieldRules, axis: 'read' | 'write'): RuleTree {
  const root = newNode();
  const list = nameList(rules);
  const names = Array.isArray(list) ? list : undefined;
  let star = false;

  for (const key of Object.keys(rules)) {
    if (key === 'fields') continue;
    const segments = ruleSegments(key);
    if (!segments) continue;
    const config = rules[key];
    if (axis === 'write' && isConfig(config)) {
      const node = nodeAt(root, segments);
      node.config = config;
      node.named = true;
    } else if (segments.length === 1) {
      nodeAt(root, segments).named = true;
    }
  }

  for (const entry of names ?? []) {
    if (typeof entry !== 'string') continue;
    if (entry === '*') {
      star = true;
      continue;
    }
    const excluded = entry.startsWith('!');
    const segments = ruleSegments(excluded ? entry.slice(1) : entry);
    if (!segments) continue;
    const node = nodeAt(root, segments);
    if (excluded) {
      node.excluded = true;
    } else {
      node.listed = true;
      node.named = true;
    }
  }

  return { root, star, hasList: names !== undefined };
}

/** A plain object is the only object the engine reads keys from. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return false;
    }
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  } catch {
    // A proxy trap threw: the value is not one the engine can read.
    return false;
  }
}

/**
 * The own value of a property, read off its descriptor so a getter never runs.
 * `opaque` marks an accessor, whose value the engine will not read.
 */
interface Slot {
  readonly present: boolean;
  readonly opaque: boolean;
  readonly value: unknown;
}

const ABSENT: Slot = { present: false, opaque: false, value: undefined };
const OPAQUE: Slot = { present: true, opaque: true, value: undefined };

function slotOf(bag: object, key: string): Slot {
  const descriptor = Object.getOwnPropertyDescriptor(bag, key);
  if (!descriptor) return ABSENT;
  if (!('value' in descriptor)) return OPAQUE;
  return { present: true, opaque: false, value: descriptor.value };
}

/**
 * The keys of one object the walk reads, and how it reads them.
 *
 * A nested object is read once: `snapshotOf` takes its descriptors in one call
 * and the walk answers every later question from that copy, so an object whose
 * answers change between calls cannot split a decision. The top-level object
 * and the write stay live, and read as the flat decision reads them.
 */
interface Bag {
  /** The enumerable string keys. */
  keys(): readonly string[];
  /** The own property by descriptor, so a getter never runs. */
  slot(key: string): Slot;
  /** The own value as the flat decision reads it. */
  value(key: string): unknown;
  /** The object holds a non-enumerable or symbol key that `keys` does not list. */
  readonly hidden: boolean;
}

function liveBag(target: object): Bag {
  return {
    hidden: false,
    keys() {
      try {
        return Object.keys(target);
      } catch {
        return [];
      }
    },
    slot(key) {
      try {
        return slotOf(target, key);
      } catch {
        return OPAQUE;
      }
    },
    value(key) {
      try {
        return hasOwn(target, key)
          ? (target as Record<string, unknown>)[key]
          : undefined;
      } catch {
        return undefined;
      }
    },
  };
}

function slotFrom(descriptor: PropertyDescriptor): Slot {
  return 'value' in descriptor
    ? { present: true, opaque: false, value: descriptor.value }
    : OPAQUE;
}

/**
 * A copy of a plain object's own properties, or undefined when the engine
 * cannot read it: an own empty-string key cannot be named by a path, and an
 * accessor would run code on read. Throws when a proxy trap throws.
 */
function snapshotOf(target: object): Bag | undefined {
  if (!isPlainObject(target)) return undefined;
  const descriptors = Object.getOwnPropertyDescriptors(target);
  const slots = new Map<string, Slot>();
  let hidden = false;
  for (const key of Reflect.ownKeys(descriptors)) {
    const descriptor = descriptors[key as string] as PropertyDescriptor;
    if (typeof key === 'symbol' || !descriptor.enumerable) {
      hidden = true;
      if (typeof key === 'string' && !('value' in descriptor)) return undefined;
      continue;
    }
    if (key === '' || !('value' in descriptor)) return undefined;
    slots.set(key, slotFrom(descriptor));
  }
  const keys = [...slots.keys()];
  return {
    hidden,
    keys: () => keys,
    slot: (key) => slots.get(key) ?? ABSENT,
    value: (key) => slots.get(key)?.value,
  };
}

/**
 * The snapshots of the plain objects an array holds, or undefined when it holds
 * anything else: a hole, an accessor, a primitive, `null`, a `Date`, a nested
 * array.
 */
function elementsOf(array: readonly unknown[]): Bag[] | undefined {
  const descriptors = Object.getOwnPropertyDescriptors(array);
  const length = (descriptors['length'] as PropertyDescriptor).value as number;
  if (!Number.isInteger(length) || length < 0) return undefined;
  // An own property other than an index would ride along on the original array
  // and be lost from a rebuilt one.
  for (const key of Reflect.ownKeys(descriptors)) {
    if (key === 'length') continue;
    const index = typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key);
    if (!index || Number(key) >= length) return undefined;
  }
  const elements: Bag[] = [];
  for (let i = 0; i < length; i++) {
    const descriptor = descriptors[i as unknown as keyof typeof descriptors];
    if (!descriptor || !('value' in descriptor)) return undefined;
    const element = descriptor.value as unknown;
    if (typeof element !== 'object' || element === null) return undefined;
    const bag = snapshotOf(element);
    if (!bag) return undefined;
    elements.push(bag);
  }
  return elements;
}

/** The containers on the current path of one side of the walk. */
type Visited = Set<object>;

/**
 * The snapshots whose keys a level reads, from the values found at one key, or
 * undefined when the engine cannot walk them. An array contributes its elements.
 * The write axis walks no array: it has no identity between the stored and the
 * proposed elements to carry a rule across.
 */
function expandSide(
  slots: readonly Slot[],
  allowArrays: boolean,
  visited: Visited,
): Bag[] | undefined {
  try {
    const bags: Bag[] = [];
    for (const slot of slots) {
      if (slot.opaque) return undefined;
      const value = slot.value;
      if (typeof value !== 'object' || value === null) return undefined;
      if (visited.has(value)) return undefined;
      if (Array.isArray(value)) {
        if (!allowArrays) return undefined;
        const elements = elementsOf(value);
        if (!elements) return undefined;
        bags.push(...elements);
      } else {
        const bag = snapshotOf(value);
        if (!bag) return undefined;
        bags.push(bag);
      }
    }
    return bags;
  } catch {
    // A proxy trap threw: nothing under it can be read.
    return undefined;
  }
}

function slotsAt(bags: readonly Bag[], key: string): Slot[] {
  const slots: Slot[] = [];
  for (const bag of bags) {
    const slot = bag.slot(key);
    if (slot.present) slots.push(slot);
  }
  return slots;
}

type Verdict = { state: FieldState; reason: FieldReason };

const NOT_TRAVERSABLE: Verdict = { state: 'denied', reason: 'not-traversable' };

/**
 * One field's write decision under a `targets` or `transitions` config, with the
 * reason it landed there.
 *
 * The two unevaluable causes are distinct, and a `transitions` field can hit
 * both at once. A missing current value outranks a missing proposed one: a
 * complete object is the first thing the caller has to supply, and the edge
 * cannot be read from either end without it.
 */
function decideConfig(
  config: FieldConfig,
  current: unknown,
  next: unknown,
): Verdict {
  if ('targets' in config) {
    if (next === undefined) {
      return { state: 'unevaluable', reason: 'proposed-required' };
    }
    return (config.targets as readonly unknown[]).includes(next)
      ? { state: 'allowed', reason: 'allow' }
      : { state: 'denied', reason: 'targets-failed' };
  }

  if (current === undefined) {
    return { state: 'unevaluable', reason: 'missing-field' };
  }
  if (next === undefined) {
    return { state: 'unevaluable', reason: 'proposed-required' };
  }
  // The current value is attacker-controlled data, so only an own property of
  // the transitions map is an edge. A prototype member names no edge, and a
  // value that is not a primitive names no edge at all: coercing an object with
  // a null prototype, a hostile `toString`, or a symbol throws, and a decision
  // is not allowed to throw.
  const edge = edgeName(current);
  const edges =
    edge !== undefined && hasOwn(config.transitions, edge)
      ? config.transitions[edge]
      : undefined;
  if (!Array.isArray(edges)) {
    return { state: 'denied', reason: 'transition-failed' };
  }
  return edges.includes(next)
    ? { state: 'allowed', reason: 'allow' }
    : { state: 'denied', reason: 'transition-failed' };
}

/** The name-list verdict for a field with no config. */
function decideName(
  tree: RuleTree,
  node: RuleNode | undefined,
  inherited: boolean,
): Verdict {
  const allow: Verdict = { state: 'allowed', reason: 'allow' };
  if (!tree.hasList) return allow;
  if (node?.excluded) return { state: 'denied', reason: 'not-listed' };
  return tree.star || inherited || node?.listed
    ? allow
    : { state: 'denied', reason: 'not-listed' };
}

interface Level {
  /** The objects of the stored value whose keys this level reads. */
  readonly stored: readonly Bag[];
  /** The objects of the proposed write, on the write axis. */
  readonly proposed: readonly Bag[];
}

interface WalkState {
  readonly tree: RuleTree;
  readonly axis: 'read' | 'write';
  fields: FieldOutcome['fields'];
  reasons: FieldOutcome['reasons'];
  readonly storedPath: Visited;
  readonly proposedPath: Visited;
}

function emit(
  state: WalkState,
  segments: readonly string[],
  verdict: Verdict,
): void {
  const key = formatPath(segments);
  put(state.fields, key, verdict.state);
  put(state.reasons, key, verdict.reason);
}

/**
 * The value of an own property, read as the flat decision reads it. A key no
 * rule descends into is a plain value to the config checks, so an own getter on
 * it answers as it does for any other field.
 */
function ownValue(bags: readonly Bag[], key: string): unknown {
  for (const bag of bags) {
    if (bag.slot(key).present) return bag.value(key);
  }
  return undefined;
}

/**
 * The data value at a path of plain own properties, or undefined. Each nested
 * object is read through one snapshot, so it answers once.
 */
function dataAt(root: Bag | undefined, segments: readonly string[]): unknown {
  try {
    let bag = root;
    let value: unknown;
    for (const [index, segment] of segments.entries()) {
      const slot = bag?.slot(segment);
      if (!slot || slot.opaque) return undefined;
      value = slot.value;
      if (index === segments.length - 1) return value;
      if (typeof value !== 'object' || value === null) return undefined;
      bag = snapshotOf(value);
    }
    return value;
  } catch {
    return undefined;
  }
}

const PATH_BRACKET = /[[\]]/;

/**
 * How the rules decide a raw write key that reads as a path. A key `address.street`
 * is one flat key to the object, and a deep merge or an ORM that splits on `.`
 * writes it as a nested path, so the write must pass both readings. A key whose
 * split is not a clean path of field names, or that holds a bracket (an index
 * path to some writers), cannot be checked as a path and is refused.
 * Undefined when the key reads as no path.
 */
function pathVerdict(
  state: WalkState,
  level: Level,
  node: RuleNode,
  inherited: boolean,
  key: string,
): Verdict | undefined {
  if (PATH_BRACKET.test(key)) return NOT_TRAVERSABLE;
  if (!key.includes('.')) return undefined;
  const segments = key.split('.');
  if (!segments.every((segment) => segment !== '' && isFieldName(segment))) {
    return NOT_TRAVERSABLE;
  }
  let at: RuleNode | undefined = node;
  let inheritedAbove = inherited;
  for (const [index, segment] of segments.slice(0, -1).entries()) {
    const next: RuleNode | undefined = at?.children.get(segment);
    // Leaving the rules below a field that has rules would write around them:
    // `lines.0.cost` reaches the `cost` that `!lines.cost` hides.
    if (!next && index > 0 && at && at.children.size > 0) {
      return NOT_TRAVERSABLE;
    }
    at = next;
    if (at?.excluded) return { state: 'denied', reason: 'not-listed' };
    // A config on a parent decides the parent's whole value, which a path
    // through it would write around.
    if (at?.config) return NOT_TRAVERSABLE;
    inheritedAbove = inheritedAbove || state.tree.star || !!at?.listed;
  }
  const last = segments[segments.length - 1] as string;
  if (!at?.children.has(last) && segments.length > 1 && at) {
    if (at.children.size > 0) return NOT_TRAVERSABLE;
  }
  at = at?.children.get(last);
  // A value written at a path with rules below it replaces that subtree.
  if (at && at.children.size > 0) return NOT_TRAVERSABLE;
  if (at?.config) {
    return decideConfig(
      at.config,
      dataAt(level.stored[0], segments),
      ownValue(level.proposed, key),
    );
  }
  return decideName(state.tree, at, inheritedAbove);
}

/**
 * Decides every key of one level, and descends into a key only where a rule
 * names a path below it and the key is not excluded. The key a rule descends
 * into leaves the map and its children enter it, so a key and one of its
 * descendants are never both there.
 *
 * `inherited` is whether a listed ancestor allows everything below it.
 *
 * Returns whether a key the stored value carries is not allowed. On the write
 * axis a walked parent with such a key is refused whole, because the picked
 * parent would replace the stored one and drop the key the caller may not write.
 */
function walkLevel(
  state: WalkState,
  level: Level,
  node: RuleNode,
  segments: readonly string[],
  inherited: boolean,
): boolean {
  const write = state.axis === 'write';
  const keys = new Set<string>();
  for (const bag of level.stored) {
    for (const key of bag.keys()) keys.add(key);
  }
  if (write) {
    for (const bag of level.proposed) {
      for (const key of bag.keys()) keys.add(key);
    }
  }
  // An exclusion below a path is reported denied even when its parent is absent
  // from the data. At the top level an exclusion alone adds no key, so a flat
  // `!name` stays out of the maps when the object lacks the field.
  for (const [key, child] of node.children) {
    if (child.named || child.children.size > 0 || segments.length > 0) {
      keys.add(key);
    }
  }

  // A stored key the walk cannot list would go missing from a replaced parent.
  let blocked = write && level.stored.some((bag) => bag.hidden);
  for (const key of keys) {
    if (!isFieldName(key)) {
      // The decision names no such key, so a replaced parent would erase it.
      if (level.stored.some((bag) => bag.slot(key).present)) blocked = true;
      continue;
    }
    const child = node.children.get(key);
    const path = [...segments, key];
    const stored = slotsAt(level.stored, key);
    const proposed = write ? slotsAt(level.proposed, key) : [];
    const done = (verdict: Verdict): void => {
      emit(state, path, verdict);
      if (stored.length > 0 && verdict.state !== 'allowed') blocked = true;
    };
    const descends = child !== undefined && child.children.size > 0;
    const descriptorValue = (slots: readonly Slot[]) =>
      slots[0]?.opaque ? undefined : slots[0]?.value;

    const verdict = child?.config
      ? decideConfig(
          child.config,
          descends ? descriptorValue(stored) : ownValue(level.stored, key),
          descends ? descriptorValue(proposed) : ownValue(level.proposed, key),
        )
      : undefined;
    const dotted = write
      ? pathVerdict(state, level, node, inherited, key)
      : undefined;
    const dottedDenied = dotted !== undefined && dotted.state !== 'allowed';

    if (!descends || child.excluded) {
      const flat = verdict ?? decideName(state.tree, child, inherited);
      done(dottedDenied && flat.state === 'allowed' ? NOT_TRAVERSABLE : flat);
      continue;
    }
    if (dottedDenied) {
      done(NOT_TRAVERSABLE);
      continue;
    }
    if (verdict && verdict.state !== 'allowed') {
      done(verdict);
      continue;
    }

    const storedNodes = expandSide(stored, !write, state.storedPath);
    const proposedNodes = expandSide(proposed, false, state.proposedPath);
    if (!storedNodes || !proposedNodes) {
      done(NOT_TRAVERSABLE);
      continue;
    }
    if (write && proposed.length > 0 && stored.length === 0) {
      done({ state: 'unevaluable', reason: 'missing-field' });
      continue;
    }

    const storedValues = stored.map((slot) => slot.value as object);
    const proposedValues = proposed.map((slot) => slot.value as object);
    for (const v of storedValues) state.storedPath.add(v);
    for (const v of proposedValues) state.proposedPath.add(v);
    const inner: WalkState = { ...state, fields: {}, reasons: {} };
    const innerBlocked = walkLevel(
      inner,
      { stored: storedNodes, proposed: proposedNodes },
      child,
      path,
      inherited || state.tree.star || child.listed,
    );
    for (const v of storedValues) state.storedPath.delete(v);
    for (const v of proposedValues) state.proposedPath.delete(v);

    if (write && innerBlocked) {
      done(NOT_TRAVERSABLE);
      continue;
    }
    for (const innerKey of Object.keys(inner.fields)) {
      put(state.fields, innerKey, inner.fields[innerKey] as FieldState);
      put(state.reasons, innerKey, inner.reasons[innerKey] as FieldReason);
    }
    if (innerBlocked && stored.length > 0) blocked = true;
  }
  return blocked;
}

/**
 * The field-level decision for one permission on one axis.
 *
 * Read is projection only: targets/transitions (write concepts) do not apply,
 * so a read field is allowed unless denied by the name list. Write applies the
 * per-field config. Missing data yields `unevaluable`, never a silent allow or
 * deny.
 *
 * A rule names a path, and the decision maps are keyed by `formatPath` strings.
 * The engine walks the stored object, and on the write axis the write, only
 * where a rule names a path below a key. Every value it cannot walk is
 * `not-traversable`.
 *
 * Field rules are leaf-level, so this answers the fields
 * alone. The action-level gate is composed on top at the entry point, which is
 * what makes the returned `allowed` a field-only claim.
 */
export function decideFields(
  permission: Permission,
  ctx: EvaluationContext,
  axis: 'read' | 'write',
  proposed?: Record<string, unknown>,
): FieldOutcome {
  const rules = permission.fields ?? {};
  const tree = buildRuleTree(rules, axis);

  // The matrix does not know the object's shape, so we consider every field the
  // object carries, every field named in the rules, and every name in the
  // allow-list (a write allow-list names the fields that may be written).
  //
  // A write also considers every key of `proposed`. A key the caller intends to
  // write is decided by the same allow-list logic as every other field, so a key
  // that exists nowhere but the write still carries a state a caller can gate
  // on. The read axis is a projection of the object and takes no write, so
  // `proposed` names nothing it decides.
  //
  // `*` and `!name` are authoring syntax for a baseline and an exclusion. They
  // are not field names, so they never key the decision maps, at any depth,
  // whichever source they arrive from.
  const fields: FieldOutcome['fields'] = {};
  const reasons: FieldOutcome['reasons'] = {};
  const state: WalkState = {
    tree,
    axis,
    fields,
    reasons,
    storedPath: new Set(),
    proposedPath: new Set(),
  };
  walkLevel(
    state,
    {
      stored: ctx.object ? [liveBag(ctx.object)] : [],
      proposed: axis === 'write' && proposed ? [liveBag(proposed)] : [],
    },
    tree.root,
    [],
    false,
  );

  const allowedAll = Object.values(fields).every((s) => s === 'allowed');
  return { allowed: allowedAll, fields, reasons };
}

/** The decision's allowed paths as a tree, for the rebuild to follow. */
interface PickNode {
  readonly children: Map<string, PickNode>;
  /** The decision allows this path. */
  allowed: boolean;
}

function pickTree(fields: FieldDecision['fields']): PickNode {
  const root: PickNode = { children: new Map(), allowed: false };
  for (const key of Object.keys(fields)) {
    // A top-level empty key is not a path, but it is a field of the flat object.
    const segments = key === '' ? [''] : parsePath(key);
    if (!segments || !segments.every(isFieldName)) continue;
    let node = root;
    for (const segment of segments) {
      let child = node.children.get(segment);
      if (!child) {
        child = { children: new Map(), allowed: false };
        node.children.set(segment, child);
      }
      node = child;
    }
    node.allowed = fields[key] === 'allowed';
  }
  return root;
}

const OMIT = Symbol('omit');

/**
 * Rebuilds the allowed part of one object. A key the tree does not carry is not
 * copied. A key the tree carries as a leaf is copied by reference. A key the
 * tree descends into is rebuilt, or left out when its value cannot be walked.
 *
 * The top-level bag is live and a leaf is read as the flat decision reads it, so
 * an own getter there answers as it does for any other field. Every level below
 * it is a snapshot.
 */
function pickObject(
  source: Bag,
  node: PickNode,
  path: Visited,
): Record<string, unknown> {
  const built: Record<string, unknown> = {};
  for (const key of source.keys()) {
    if (!isFieldName(key)) continue;
    const child = node.children.get(key);
    if (!child) continue;
    if (child.children.size === 0) {
      if (child.allowed) put(built, key, source.value(key));
      continue;
    }
    const slot = source.slot(key);
    if (slot.opaque) continue;
    const picked = pickValue(slot.value, child, path);
    if (picked !== OMIT) put(built, key, picked);
  }
  return built;
}

function pickValue(value: unknown, node: PickNode, path: Visited): unknown {
  if (typeof value !== 'object' || value === null || path.has(value)) {
    return OMIT;
  }
  path.add(value);
  try {
    if (Array.isArray(value)) {
      const elements = elementsOf(value);
      if (!elements) return OMIT;
      const built: unknown[] = [];
      elements.forEach((element, index) => {
        put(
          built as unknown as Record<string, unknown>,
          String(index),
          pickObject(element, node, path),
        );
      });
      return built;
    }
    const bag = snapshotOf(value);
    if (!bag) return OMIT;
    const built = pickObject(bag, node, path);
    return Object.keys(built).length > 0 ? built : OMIT;
  } catch {
    // A proxy trap threw: the value cannot be walked.
    return OMIT;
  } finally {
    path.delete(value);
  }
}

/**
 * The part of a proposed write the decision allows: every leaf whose state is
 * `allowed`, and nothing else. This is the value to write.
 *
 * A key the decision does not carry is not written. Only `allowed` passes, so
 * `denied` and `unevaluable` are both withheld, and so is a key that reached the
 * decision under a different `proposed` object.
 *
 * Where the decision carries paths below a key, the key is rebuilt as a new
 * object or array holding the allowed part. An object appears only when one of
 * its children does. An array keeps every element and its index, so an element
 * whose children were all withheld is `{}`. A value that cannot be walked where
 * the decision descends is withheld whole. A subtree the decision does not
 * descend into is copied by reference.
 *
 * Throws `ActionNotAllowedError` when the action is refused, because no field of
 * a refused action is writable and an empty object would read as a lawful write
 * of nothing. A field the action allows but the rules deny is a partial write,
 * which is what filtering is for, so a `false` top-level `allowed` from the
 * field maps alone returns the allowed subset.
 */
export function pickAllowedFields<T extends Record<string, unknown>>(
  decision: FieldDecision,
  proposed: T,
): Partial<T> {
  if (!decision.action.allowed) {
    throw new ActionNotAllowedError(
      decision.action.key,
      decision.action.reason,
    );
  }
  return pickObject(
    liveBag(proposed),
    pickTree(decision.fields),
    new Set(),
  ) as Partial<T>;
}
