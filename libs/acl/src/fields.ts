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
  const segments = parsePath(path);
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
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
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
 * The plain objects an array holds, or undefined when it holds anything else:
 * a hole, an accessor, a primitive, `null`, a `Date`, a nested array.
 */
function elementsOf(array: readonly unknown[]): object[] | undefined {
  // Own keys equal the length only when no index is a hole.
  if (Object.keys(array).length !== array.length) return undefined;
  const elements: object[] = [];
  for (let i = 0; i < array.length; i++) {
    const slot = slotOf(array, String(i));
    if (slot.opaque || !isPlainObject(slot.value)) return undefined;
    elements.push(slot.value);
  }
  return elements;
}

/**
 * Whether the engine can read every key of an object it expands. An own
 * empty-string key cannot be named by a path. An accessor would run code on
 * read, and the walk reads descriptors only.
 */
function isReadable(bag: object): boolean {
  if (hasOwn(bag, '')) return false;
  return Object.values(Object.getOwnPropertyDescriptors(bag)).every(
    (descriptor) => 'value' in descriptor,
  );
}

/** The containers on the current path of one side of the walk. */
type Visited = Set<object>;

/**
 * The objects whose keys a level reads, from the values found at one key, or
 * undefined when the engine cannot walk them. An array contributes its elements.
 * The write axis walks no array: it has no identity between the stored and the
 * proposed elements to carry a rule across.
 */
function expandSide(
  slots: readonly Slot[],
  allowArrays: boolean,
  visited: Visited,
): object[] | undefined {
  const nodes: object[] = [];
  for (const slot of slots) {
    if (slot.opaque) return undefined;
    const value = slot.value;
    if (typeof value !== 'object' || value === null) return undefined;
    if (visited.has(value)) return undefined;
    if (Array.isArray(value)) {
      if (!allowArrays) return undefined;
      const elements = elementsOf(value);
      if (!elements) return undefined;
      nodes.push(...elements);
    } else if (isPlainObject(value)) {
      nodes.push(value);
    } else {
      return undefined;
    }
  }
  return nodes.every(isReadable) ? nodes : undefined;
}

function slotsAt(nodes: readonly object[], key: string): Slot[] {
  const slots: Slot[] = [];
  for (const node of nodes) {
    const slot = slotOf(node, key);
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
  readonly stored: readonly object[];
  /** The objects of the proposed write, on the write axis. */
  readonly proposed: readonly object[];
}

interface WalkState {
  readonly tree: RuleTree;
  readonly axis: 'read' | 'write';
  readonly fields: FieldOutcome['fields'];
  readonly reasons: FieldOutcome['reasons'];
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
 * Decides every key of one level, and descends into a key only where a rule
 * names a path below it and the key is not excluded. The key a rule descends
 * into leaves the map and its children enter it, so a key and one of its
 * descendants are never both there.
 *
 * `inherited` is whether a listed ancestor allows everything below it.
 */
function walkLevel(
  state: WalkState,
  level: Level,
  node: RuleNode,
  segments: readonly string[],
  inherited: boolean,
): void {
  const write = state.axis === 'write';
  const keys = new Set<string>();
  for (const bag of level.stored) {
    for (const key of Object.keys(bag)) keys.add(key);
  }
  if (write) {
    for (const bag of level.proposed) {
      for (const key of Object.keys(bag)) keys.add(key);
    }
  }
  // An exclusion below a key the data does carry is reported denied. At the top
  // level an exclusion alone adds no key, so a flat `!name` stays out of the
  // maps when the object lacks the field.
  for (const [key, child] of node.children) {
    if (child.named || child.children.size > 0 || segments.length > 0) {
      keys.add(key);
    }
  }

  for (const key of keys) {
    if (!isFieldName(key)) continue;
    const child = node.children.get(key);
    const path = [...segments, key];
    const stored = slotsAt(level.stored, key);
    const proposed = write ? slotsAt(level.proposed, key) : [];
    const first = (slots: readonly Slot[]) =>
      slots[0]?.opaque ? undefined : slots[0]?.value;

    const verdict = child?.config
      ? decideConfig(child.config, first(stored), first(proposed))
      : undefined;
    const descends = child !== undefined && child.children.size > 0;

    if (!descends || child.excluded) {
      emit(state, path, verdict ?? decideName(state.tree, child, inherited));
      continue;
    }
    if (verdict && verdict.state !== 'allowed') {
      emit(state, path, verdict);
      continue;
    }

    const storedNodes = expandSide(stored, !write, state.storedPath);
    const proposedNodes = expandSide(proposed, false, state.proposedPath);
    if (!storedNodes || !proposedNodes) {
      emit(state, path, NOT_TRAVERSABLE);
      continue;
    }

    const storedValues = stored.map((slot) => slot.value as object);
    const proposedValues = proposed.map((slot) => slot.value as object);
    for (const v of storedValues) state.storedPath.add(v);
    for (const v of proposedValues) state.proposedPath.add(v);
    walkLevel(
      state,
      { stored: storedNodes, proposed: proposedNodes },
      child,
      path,
      inherited || state.tree.star || child.listed,
    );
    for (const v of storedValues) state.storedPath.delete(v);
    for (const v of proposedValues) state.proposedPath.delete(v);
  }
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
      stored: ctx.object ? [ctx.object] : [],
      proposed: axis === 'write' && proposed ? [proposed] : [],
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
 */
function pickObject(
  source: Record<string, unknown>,
  node: PickNode,
  path: Visited,
): Record<string, unknown> {
  const built: Record<string, unknown> = {};
  for (const key of Object.keys(source)) {
    if (!isFieldName(key)) continue;
    const child = node.children.get(key);
    if (!child) continue;
    const slot = slotOf(source, key);
    if (slot.opaque) continue;
    if (child.children.size === 0) {
      if (child.allowed) put(built, key, slot.value);
      continue;
    }
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
          pickObject(element as Record<string, unknown>, node, path),
        );
      });
      return built;
    }
    if (!isPlainObject(value)) return OMIT;
    const built = pickObject(value, node, path);
    return Object.keys(built).length > 0 ? built : OMIT;
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
    proposed,
    pickTree(decision.fields),
    new Set(),
  ) as Partial<T>;
}
