import { PayloadPicker } from './PayloadPicker';
import { renders } from './renders';

/**
 * The control on `/astro-widget/bad-items`: pick a payload, and see what
 * `validateItems` reports for it and what `Widgets.astro` renders.
 *
 * A server component, so the payloads reach the page as props in the exported
 * HTML rather than as a module in a shared script chunk. `PayloadPicker` holds
 * which one is picked.
 */
export default function AstroRenderDemo() {
  return <PayloadPicker payloads={renders} />;
}
