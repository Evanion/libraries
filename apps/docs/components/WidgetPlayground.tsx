'use client';

import { useState, useEffect } from 'react';
import { LiveProvider, LiveError, LivePreview, LiveEditor } from 'react-live';
import { themes } from 'prism-react-renderer';
import { Button } from '@evanion/baize-ui';
import { playgroundScope } from './playground-scope';

interface WidgetPlaygroundProps {
  /**
   * The snippet the preview starts from. It is evaluated by react-live in
   * `noInline` mode, so it has to end in a `render(<… />)` call, and every name
   * it uses has to be in `playgroundScope` -- there is no module resolution
   * inside the snippet.
   */
  initialCode: string;
  /** Editor height in pixels, and the preview panel's minimum height. */
  height?: number;
  /** Whether the Code tab is offered. The preview tab is always there. */
  showEditor?: boolean;
}

/**
 * An editable code sample with a live preview, usable as a JSX tag in any MDX
 * page through the map in mdx-components.js.
 *
 * A client component: it evaluates the snippet in the browser, which has no
 * server rendering.
 *
 * The editor is react-live's own, so the text a reader edits is the string the
 * provider beside it evaluates, with no second copy and no bridge between two
 * libraries. `LiveProvider` holds no code of its own -- `context.code` is
 * whatever it was handed -- so the state lives here and `LiveEditor`'s
 * `onChange` writes to it.
 *
 * @example
 * ```mdx
 * <WidgetPlayground initialCode={`render(<b>hi</b>)`} height={300} />
 * ```
 */
export default function WidgetPlayground({
  initialCode,
  height = 400,
  showEditor = true,
}: WidgetPlaygroundProps) {
  const [code, setCode] = useState(initialCode);
  const [activeTab, setActiveTab] = useState<'preview' | 'editor'>('preview');
  const [isDark, setIsDark] = useState(false);

  // A prism theme is an object of literal colours, not a stylesheet, so the
  // active theme has to be resolved in JS. next-themes, which
  // nextra-theme-docs uses, records the choice by writing a class onto <html>
  // outside React, so the element is observed directly; `prefers-color-scheme`
  // covers the "system" setting, under which next-themes writes nothing.
  useEffect(() => {
    const checkTheme = () => {
      const isDarkMode =
        document.documentElement.classList.contains('dark') ||
        document.documentElement.getAttribute('data-theme') === 'dark' ||
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDark(isDarkMode);
    };

    checkTheme();

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    });

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', checkTheme);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', checkTheme);
    };
  }, []);

  return (
    <div className="widget-playground">
      <LiveProvider
        code={code}
        scope={playgroundScope}
        noInline={true}
        language="tsx"
        theme={isDark ? themes.vsDark : themes.vsLight}
      >
        <div className="playground-header">
          <div className="playground-tabs">
            <Button
              variant={activeTab === 'preview' ? 'standard' : 'quiet'}
              onClick={() => setActiveTab('preview')}
            >
              Preview
            </Button>
            {showEditor && (
              <Button
                variant={activeTab === 'editor' ? 'standard' : 'quiet'}
                onClick={() => setActiveTab('editor')}
              >
                Code
              </Button>
            )}
          </div>
        </div>

        <div className="playground-content">
          {activeTab === 'preview' ? (
            <div className="preview-panel">
              <div className="preview-container">
                <LivePreview />
                <LiveError className="error-display" />
              </div>
            </div>
          ) : (
            <div className="editor-panel">
              <LiveEditor onChange={setCode} className="editor-surface" />
            </div>
          )}
        </div>
      </LiveProvider>

      {/*
        The frame, in the design system's own properties.

        Every colour here is one of the six ground roles `app/global.css` binds
        per theme, so the playground follows the site's light/dark toggle without
        a single value in this file and without a second set to keep in step. What
        is left in JS is the prism theme, which the editor takes as an object of
        literal colours rather than reading from CSS.
      */}
      <style jsx>{`
        .widget-playground {
          position: relative;
          z-index: 0;
          margin: var(--baize-space-5) 0;
          border: 1px solid var(--baize-rule);
          border-radius: var(--baize-radius-card);
          background: var(--baize-felt);
          box-shadow: var(--baize-elevation-card);
        }

        .playground-header {
          padding: var(--baize-space-2);
          border-bottom: 1px solid var(--baize-rule);
        }

        .playground-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: var(--baize-space-2);
        }

        .playground-content {
          position: relative;
        }

        .preview-panel {
          padding: var(--baize-space-4);
          min-height: ${height}px;
        }

        /* Recessed, so a snippet's own colours sit on something that is not the
           card they are already on. The same mix the library's Panel uses. */
        .preview-container {
          padding: var(--baize-space-4);
          border-radius: var(--baize-radius-card);
          background: color-mix(
            in oklab,
            var(--baize-felt) 60%,
            var(--baize-ink)
          );
          color: var(--baize-chalk);
        }

        .editor-panel {
          border-top: 1px solid var(--baize-rule);
        }

        /*
         * react-live edits the highlighted <pre> itself, through use-editable,
         * and sets font-family: inherit on it. So the type is set here, on
         * the box around it, and the box is the one that scrolls -- the <pre>
         * grows with the snippet, and without a height on the panel a long one
         * would push the rest of the page down.
         *
         * :global is what reaches an element react-live rendered from a
         * styled-jsx block, which otherwise scopes every selector to this
         * component's own elements.
         */
        .editor-panel :global(.editor-surface) {
          height: ${height}px;
          overflow: auto;
          font-family: var(--x-font-mono);
          font-size: var(--baize-text-sm);
          line-height: var(--baize-leading-normal);
        }

        /*
         * The prism theme paints its ground on the <pre>, which is only as
         * tall as the snippet. Filling the box keeps a short snippet from
         * sitting on a band of the editor's ground and a band of the card's.
         */
        .editor-panel :global(.editor-surface pre) {
          box-sizing: border-box;
          min-height: 100%;
        }

        /* The editable element is the <pre>, so the focus ring goes on it. */
        .editor-panel :global(.editor-surface pre:focus-visible) {
          outline: 2px solid var(--baize-hue, var(--baize-chalk));
          outline-offset: -2px;
        }

        /*
         * A snippet that threw.
         *
         * Nextra's own red rather than a Baize value. The design system has a
         * ground, a complexity ladder and two colour systems that belong to the
         * shop; it has no error role, and adding one from the docs app would make
         * this file the second author of the palette. The theme's caution
         * callouts are already this colour, so a broken snippet reads like every
         * other warning on the site.
         */
        .error-display {
          margin-top: var(--baize-space-4);
          padding: var(--baize-space-3);
          border: 1px solid var(--x-color-red-600);
          border-radius: var(--baize-radius-button);
          background: color-mix(
            in oklab,
            var(--x-color-red-600) 12%,
            var(--baize-felt)
          );
          color: var(--x-color-red-600);
          font-family: var(--x-font-mono);
          font-size: var(--baize-text-sm);
          white-space: pre-wrap;
        }
      `}</style>
    </div>
  );
}
