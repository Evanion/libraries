import { deskItems, type DeskMeta } from './desk';
import { listing } from './listing';

/**
 * An item as the demo walks it.
 *
 * The widget set's own `WidgetItem` union is discriminated on `type`, which is
 * what makes `deskItems` checked where it is written. Walking it is a different
 * job: the walk reads `children` and swaps siblings without caring which
 * component an item names, and narrowing the union at every step to learn
 * nothing from it costs a cast per branch. So it is widened here, once, and
 * narrowed back on the way into `Widgets`.
 */
export interface Node {
  id: string;
  type: string;
  props: Record<string, string>;
  meta?: DeskMeta;
  children?: Node[];
}

/** The page the demo opens on, as the walk sees it. */
export const openingNodes = deskItems as unknown as Node[];

/** What the interface calls an item: the title it carries, or its id. */
export function nameOf(node: Node): string {
  return node.props.title ?? node.props.label ?? node.id;
}

/**
 * The tree with one item swapped past the sibling above or below it.
 *
 * A path of indices rather than an id, because an id is only unique by
 * accident in CMS data and a sibling list is where a move is defined: an item
 * moves within the region that holds it, and nothing else in the tree changes.
 */
export function moved(
  nodes: Node[],
  path: readonly number[],
  delta: number,
): Node[] {
  const [index, ...rest] = path;
  if (index === undefined) return nodes;

  if (rest.length === 0) {
    const target = index + delta;
    if (target < 0 || target >= nodes.length) return nodes;
    const next = [...nodes];
    next[index] = nodes[target]!;
    next[target] = nodes[index]!;
    return next;
  }

  return nodes.map((node, at) =>
    at === index
      ? { ...node, children: moved(node.children ?? [], rest, delta) }
      : node,
  );
}

/** One line of the listing, and the item it starts when it starts one. */
export interface Row {
  /** React key: an item's own line and its closing line, kept apart. */
  key: string;
  text: string;
  /**
   * Which item's block this line belongs to, opening and closing lines alike.
   *
   * The listing is a flat list of lines and a subtree is a run within it, so
   * this is what lets the caller light a container and everything nested under
   * it: a line is in the block when the container's path is a prefix of this.
   * Absent on the two lines that bracket the whole list, which belong to no
   * item.
   */
  path?: number[];
  item?: { path: number[]; name: string; first: boolean; last: boolean };
}

/** Whether `path` names `candidate` or something nested inside it. */
export function within(path: readonly number[], candidate?: number[]): boolean {
  return (
    candidate !== undefined &&
    path.length <= candidate.length &&
    path.every((step, at) => candidate[at] === step)
  );
}

/**
 * The items as the JSON they are, one line per item.
 *
 * Every field an item carries is on its line -- id, type, props, meta -- and a
 * container breaks after `"children": [` so its nested items are the lines
 * under it, indented. What is on the screen parses back to the items the page
 * rendered from, which `tree.test.ts` holds it to: a reader can select it and
 * run it.
 */
export function rows(nodes: Node[]): Row[] {
  const out: Row[] = [{ key: '/open', text: '[' }];
  walk(nodes, [], 1, out);
  out.push({ key: '/close', text: ']' });
  return out;
}

/**
 * How wide an item's own object may be before the formatter folds it.
 *
 * One line per item is the whole readability claim, so this is set past the
 * longest item here rather than to the column: the listing runs the width of
 * the figure, and a folded item would read as four items.
 */
const ITEM = 96;

function walk(nodes: Node[], path: number[], depth: number, out: Row[]): void {
  const pad = '  '.repeat(depth);

  nodes.forEach((node, index) => {
    const fields = [
      `"id": ${JSON.stringify(node.id)}`,
      `"type": ${JSON.stringify(node.type)}`,
      `"props": ${listing(node.props, ITEM)}`,
    ];
    if (node.meta) fields.push(`"meta": ${listing(node.meta, ITEM)}`);

    const tail = index === nodes.length - 1 ? '' : ',';
    const item = {
      path: [...path, index],
      name: nameOf(node),
      first: index === 0,
      last: index === nodes.length - 1,
    };

    if (node.children) {
      out.push({
        key: node.id,
        text: `${pad}{ ${fields.join(', ')}, "children": [`,
        path: item.path,
        item,
      });
      walk(node.children, item.path, depth + 1, out);
      out.push({
        key: `${node.id}/end`,
        text: `${pad}] }${tail}`,
        path: item.path,
      });
      return;
    }

    out.push({
      key: node.id,
      text: `${pad}{ ${fields.join(', ')} }${tail}`,
      path: item.path,
      item,
    });
  });
}
