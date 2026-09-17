/**
 * Rewrites a ```mermaid fence into the site's own `<Diagram>`, during
 * `next build`.
 *
 *     ```mermaid caption="What the figure shows."
 *     flowchart TD
 *       A --> B
 *     ```
 *
 * The fence is what an author writes, rather than the component, because a fence
 * is portable: it renders on GitHub, in an editor preview and in whatever reads
 * the file next, and it stays a code block to every tool that has never heard of
 * this site.
 *
 * It has to be gone before Nextra compiles the page. Nextra runs
 * `@theguild/remark-mermaid` over the same fence unconditionally, and that
 * plugin does not resolve its component through the MDX provider: it unshifts a
 * literal `import { Mermaid } from '@theguild/remark-mermaid/mermaid'` into the
 * document, which shadows anything `mdx-components.js` could put under that name
 * — and that component renders in Mermaid's stock palette and re-runs the whole
 * layout on every theme toggle.
 *
 * A loader rather than a remark plugin, for the reason
 * `@evanion/doc-examples/mdx-region-loader` is one: Nextra hands
 * `mdxOptions.remarkPlugins` straight to unified, which takes plugin functions,
 * while Next 16 requires every Turbopack loader option to be serializable and
 * fails the build on a config carrying one. A loader's module path is a string,
 * and it runs ahead of Nextra's own.
 *
 * `<Diagram>` is emitted as a bare JSX name with no import, so the provider
 * resolves it — which is how every other component a page may write without
 * importing gets there.
 */

const CAPTION = /(?:^|\s)caption="([^"]*)"/;

/**
 * Expands every Mermaid fence in an MDX source.
 *
 * Textual rather than AST-based, and the same fence scan the region loader
 * walks: a fence's delimiters are the whole of what has to be recognised, and
 * running the document through a parser to find them would buy nothing.
 */
export function expandDiagrams(source) {
  const out = [];
  let fence = null;
  let chart = null;
  let caption;

  for (const line of source.split('\n')) {
    const marker = line.match(/^(\s*)(`{3,})(.*)$/);
    const opening = marker && fence === null;
    const closing = marker && fence !== null && marker[2].startsWith(fence);

    if (opening) {
      const [, , ticks, info] = marker;
      fence = ticks;

      if (info.trim().split(/\s+/)[0] !== 'mermaid') {
        out.push(line);
        continue;
      }

      const match = CAPTION.exec(info);
      caption = match ? match[1] : undefined;
      chart = [];
      continue;
    }

    if (closing) {
      fence = null;

      if (chart === null) {
        out.push(line);
        continue;
      }

      const props = [`chart={${JSON.stringify(chart.join('\n'))}}`];
      if (caption !== undefined) {
        props.push(`caption=${JSON.stringify(caption)}`);
      }

      // Blank lines around it, so MDX reads the tag as a flow element rather
      // than as text inside whatever paragraph preceded the fence.
      out.push('', `<Diagram ${props.join(' ')} />`, '');
      chart = null;
      caption = undefined;
      continue;
    }

    if (chart === null) out.push(line);
    else chart.push(line);
  }

  return out.join('\n');
}

/**
 * The loader entry point, configured in apps/docs/next.config.ts under
 * `turbopack.rules`.
 */
export default function mdxDiagramLoader(source) {
  return expandDiagrams(source);
}
