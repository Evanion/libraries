import type { MermaidConfig } from 'mermaid';

import { diagramThemeCss, diagramThemeVariables } from './palette';

/**
 * The options every Mermaid render on the site runs under.
 *
 * `Diagram.tsx` renders the page with these and `diagram.test.ts` renders the
 * site's fences with them, so the test checks the configuration the reader gets.
 */
export const diagramConfig = {
  startOnLoad: false,
  // The charts come from the repo's own content. `loose` is what would let a
  // label carry raw HTML and a click handler, and nothing here needs either.
  securityLevel: 'strict',
  theme: 'base',
  // Mermaid's other looks draw a gradient stroke and a grey drop shadow that no
  // theme variable reaches, so they would be the one place its own palette
  // survives.
  look: 'classic',
  // Mermaid lays flowcharts out with ELK unless told otherwise. The site's
  // diagrams are drawn against dagre's ranking and edge routing, and ELK moves
  // their nodes and bends their edges differently.
  layout: 'dagre',
  themeVariables: diagramThemeVariables,
  themeCSS: diagramThemeCss,
  flowchart: {
    // With this on, Mermaid pins the SVG to the container's width, and a
    // diagram wider than a phone is scaled down until its labels are a few
    // pixels tall. Off, the SVG keeps the size its text needs and the frame
    // around it scrolls.
    useMaxWidth: false,
    htmlLabels: true,
    // Mermaid wraps a flowchart label at 120px and widens a shorter one to
    // 120px unless told otherwise. The site's diagrams are drawn against labels
    // that wrap at 200px and keep the width of their text.
    wrappingWidth: 200,
    minNodeWidth: 0,
  },
} as const satisfies MermaidConfig;
