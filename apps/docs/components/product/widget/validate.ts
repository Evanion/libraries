import { validateItems } from '@evanion/react-widget';
import type { AnyWidgetItem, WidgetProblem } from '@evanion/react-widget';

export type Fault = 'rename' | 'blank' | 'duplicate';

export const FAULTS: { id: Fault; label: string }[] = [
  { id: 'rename', label: 'Rename the shelf type' },
  { id: 'blank', label: 'Blank a listing title' },
  { id: 'duplicate', label: 'Reuse an id' },
];

/** The types the shop's renderer has a component for. */
const KNOWN = ['listing', 'shelf'];

/** Props the editor must fill in before a page may ship. */
const REQUIRED = { listing: ['title'] };

/** The page as the CMS saved it, with the chosen faults introduced. */
export function page(faults: readonly Fault[]): AnyWidgetItem[] {
  return [
    {
      id: 'brass',
      type: 'listing',
      props: { title: 'Brass: Birmingham' },
    },
    {
      id: faults.includes('duplicate') ? 'brass' : 'tonight',
      type: faults.includes('rename') ? 'featured-shelf' : 'shelf',
      props: { heading: 'On the table tonight' },
      children: [
        {
          id: 'wingspan',
          type: 'listing',
          props: { title: faults.includes('blank') ? '' : 'Wingspan' },
        },
      ],
    },
  ];
}

/** What the real `validateItems` says about the page. */
export function problemsFor(faults: readonly Fault[]): WidgetProblem[] {
  return validateItems(page(faults), KNOWN, REQUIRED);
}

/** The line a reader sees under the problem list. */
export function summary(problems: readonly WidgetProblem[]): string {
  if (problems.length === 0) return 'No problems. The build can go ahead.';
  return `${problems.length} ${problems.length === 1 ? 'problem' : 'problems'}. The build stops.`;
}

export interface PayloadLine {
  key: string;
  text: string;
  lit: boolean;
}

/** The payload as lines of source, the ones a fault edited marked. */
export function listing(faults: readonly Fault[]): PayloadLine[] {
  const renamed = faults.includes('rename');
  const blanked = faults.includes('blank');
  const reused = faults.includes('duplicate');
  return [
    { key: 'open', text: '[', lit: false },
    {
      key: 'brass',
      text: "  { id: 'brass', type: 'listing', props: { title: 'Brass: Birmingham' } },",
      lit: false,
    },
    {
      key: 'shelf',
      text: `  { id: '${reused ? 'brass' : 'tonight'}', type: '${renamed ? 'featured-shelf' : 'shelf'}', props: { heading: 'On the table tonight' },`,
      lit: renamed || reused,
    },
    { key: 'children', text: '    children: [', lit: false },
    {
      key: 'wingspan',
      text: `      { id: 'wingspan', type: 'listing', props: { title: '${blanked ? '' : 'Wingspan'}' } },`,
      lit: blanked,
    },
    { key: 'children-close', text: '    ] },', lit: false },
    { key: 'close', text: ']', lit: false },
  ];
}
