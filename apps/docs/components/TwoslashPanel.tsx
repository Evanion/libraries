import { fromHtml } from 'hast-util-from-html';
import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import { Popup } from 'nextra/components';
import { useMDXComponents as getThemeComponents } from 'nextra-theme-docs';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';

const themeComponents = getThemeComponents();

/**
 * A Twoslash hover's popup, from the HTML string `tools/popup-panels.mjs`
 * writes at build time.
 *
 * The string becomes elements here, while the page is rendered, through the
 * same theme components MDX would have compiled the popup's code, paragraphs
 * and links against, so the popup renders as it would have from the element
 * tree. Turbopack only ever holds the string. Nextra's own panel opens and
 * places it as every other popup on the site.
 *
 * The string is sanitized where it is written, and parsed here as a tree, never
 * set as HTML.
 */
export default function TwoslashPanel({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  const tree = fromHtml(html, { fragment: true });
  return (
    <Popup.Panel className={className}>
      {toJsxRuntime(tree, {
        Fragment,
        jsx,
        jsxs,
        components: themeComponents,
      })}
    </Popup.Panel>
  );
}
