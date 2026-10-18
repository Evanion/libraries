import { createFeatures } from '@evanion/feature';
import type { TreeNode } from '../primitives/DecisionTree';

type Key = 'new-checkout' | 'express-pickup' | 'demo-night-booking';

export const LABELS: Record<Key, string> = {
  'new-checkout': 'New checkout',
  'express-pickup': 'Express pickup',
  'demo-night-booking': 'Demo-night booking',
};

/** The plain-words name of a feature key. */
export function labelOf(key: string | number): string {
  return (LABELS as Record<string, string>)[String(key)] ?? String(key);
}

/** The document: express pickup needs the new checkout, demo-night booking needs express pickup. */
export function cascadeStore(checkoutOn: boolean) {
  return createFeatures([
    { key: 'new-checkout', enabled: checkoutOn },
    { key: 'express-pickup', enabled: true, dependsOn: ['new-checkout'] },
    { key: 'demo-night-booking', enabled: true, dependsOn: ['express-pickup'] },
  ]);
}

/** What switching the new checkout off would take with it, asked of a fresh store so nothing shown changes. */
export function preview(checkoutOn: boolean): string[] {
  const result = cascadeStore(checkoutOn).toggle('new-checkout', false);
  return result.ok ? [...result.willDisable] : [];
}

function reasonOf(decision: {
  enabled: boolean;
  reason: string;
  blockedBy?: string | number;
}): string {
  if (decision.enabled) return 'on';
  if (decision.reason === 'dependency-off' && decision.blockedBy !== undefined)
    return `off because ${labelOf(decision.blockedBy)} is off`;
  return 'switched off';
}

/** The three features as a tree, each with its state and reason. */
export function tree(checkoutOn: boolean): TreeNode {
  const d = cascadeStore(checkoutOn).resolve();
  const node = (key: Key, children?: TreeNode[]): TreeNode => ({
    key,
    label: LABELS[key],
    on: d[key].enabled,
    reason: reasonOf(d[key]),
    children,
  });
  return node('new-checkout', [
    node('express-pickup', [node('demo-night-booking')]),
  ]);
}
