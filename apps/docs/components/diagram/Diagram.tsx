'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { bindPalette, diagramThemeCss, diagramThemeVariables } from './palette';

/**
 * A Mermaid diagram, drawn in the site's own colours.
 *
 * An author does not write this tag. `tools/remark-diagram.mjs` turns a
 * ```mermaid fence into one, ahead of the plugin Nextra runs for the same
 * fence, so the page keeps the fence and the site keeps the component.
 *
 * Three things this does that Nextra's own Mermaid component does not.
 *
 * It renders once. The stock component picks `theme: 'dark'` or `'default'` from
 * the class on `<html>` and re-runs the whole layout when that class changes;
 * the colours here are custom properties, so the toggle recolours the SVG in
 * place and nothing re-renders.
 *
 * It never loads Mermaid on a page that has no diagram, and not until one is
 * about to be read: the import is dynamic and fires on intersection. Mermaid is
 * around 500 kB of JavaScript, which is more than the rest of this site's client
 * code put together.
 *
 * And a render that fails falls back to the fence's own text rather than to
 * Mermaid's error graphic, so a broken diagram still says what it was trying to
 * say.
 */

interface DiagramProps {
  /** The fence's body, in Mermaid's syntax. */
  chart: string;
  /**
   * What the figure shows, in a sentence.
   *
   * Required by `tools/repo-checks/src/diagram-captions.test.ts` rather than by
   * the type, so that a missing one fails a test naming the page instead of
   * failing the build with a type error in generated MDX.
   */
  caption?: string;
}

export default function Diagram({ chart, caption }: DiagramProps) {
  // `useId` spells an id with colons, which is not a legal `id` attribute and is
  // what Mermaid scopes its generated stylesheet with.
  const id = useId().replaceAll(':', '');
  const frame = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;

    let live = true;

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      void draw();
    });

    observer.observe(element);

    async function draw() {
      try {
        const { default: mermaid } = await import('mermaid');

        mermaid.initialize({
          startOnLoad: false,
          // The charts come from the repo's own content. `loose` is what would
          // let a label carry raw HTML and a click handler, and nothing here
          // needs either.
          securityLevel: 'strict',
          theme: 'base',
          // Mermaid's other looks draw a gradient stroke and a grey drop
          // shadow that no theme variable reaches, so they would be the one
          // place its own palette survives.
          look: 'classic',
          themeVariables: diagramThemeVariables,
          themeCSS: diagramThemeCss,
          flowchart: {
            // With this on, Mermaid pins the SVG to the container's width, and
            // a diagram wider than a phone is scaled down until its labels are
            // a few pixels tall. Off, the SVG keeps the size its text needs and
            // the frame around it scrolls.
            useMaxWidth: false,
            htmlLabels: true,
          },
        });

        const { svg: rendered } = await mermaid.render(id, chart);
        if (live) setSvg(bindPalette(rendered));
      } catch {
        if (live) setFailed(true);
      }
    }

    return () => {
      live = false;
      observer.disconnect();
    };
  }, [chart, id]);

  // The frame's markup is Mermaid's own output over a chart that came from a
  // file in this repo, rendered under `securityLevel: 'strict'`, which runs
  // every label through DOMPurify. Nothing in it is reader input.
  const rendered = svg ? { dangerouslySetInnerHTML: { __html: svg } } : {};

  return (
    <figure className="docs-diagram">
      <div
        ref={frame}
        className="docs-diagram__frame"
        // Scrollable, so it has to be reachable and describable without a
        // mouse. The caption is the description either way: it is the claim the
        // figure makes, which is what a reader who cannot see it needs.
        tabIndex={0}
        role="group"
        aria-label={caption}
        {...rendered}
      >
        {failed ? <pre className="docs-diagram__source">{chart}</pre> : null}
      </div>
      {caption ? <figcaption>{caption}</figcaption> : undefined}
    </figure>
  );
}
