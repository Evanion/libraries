import './primitives.css';

/** One feature in a dependency tree: whether it is on, and why, in plain words. */
export interface TreeNode {
  key: string;
  label: string;
  on: boolean;
  reason: string;
  children?: TreeNode[];
}

function Branch({ node }: { node: TreeNode }) {
  return (
    <li data-on={node.on ? '' : undefined}>
      <span className="decision-tree__label">{node.label}</span>
      <span className="decision-tree__reason">{node.reason}</span>
      {node.children?.length ? (
        <ul>
          {node.children.map((c) => (
            <Branch key={c.key} node={c} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** A dependency tree of features, each with its state and reason. Presentation only. */
export function DecisionTree({
  root,
  label,
}: {
  root: TreeNode;
  label: string;
}) {
  return (
    <ul className="decision-tree" aria-label={label}>
      <Branch node={root} />
    </ul>
  );
}
