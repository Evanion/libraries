'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { LiveProvider, LiveError, LivePreview } from 'react-live';
import { Button } from '@evanion/baize-ui';
import { Editor } from '@monaco-editor/react';
import type { OnMount } from '@monaco-editor/react';
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
 * A client component: it evaluates the snippet in the browser and loads Monaco,
 * neither of which has a server rendering.
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

  // Monaco takes its theme as a prop rather than reading CSS, so the active
  // theme has to be resolved in JS. next-themes, which nextra-theme-docs uses,
  // records the choice by writing a class onto <html> outside React, so the
  // element is observed directly; `prefers-color-scheme` covers the "system"
  // setting, under which next-themes writes nothing.
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

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      setCode(value);
    }
  }, []);

  // Monaco's TypeScript defaults assume a plain module with no JSX and no
  // ambient React, and its diagnostics are independent of react-live's
  // evaluation. Without the three calls below the editor marks every snippet as
  // broken while the preview renders it correctly.
  const handleEditorDidMount = useCallback<OnMount>((editor, monaco) => {
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.Latest,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.CommonJS,
      noEmit: true,
      esModuleInterop: true,
      jsx: monaco.languages.typescript.JsxEmit.React,
      reactNamespace: 'React',
      allowJs: true,
      typeRoots: ['node_modules/@types'],
      strict: false,
      skipLibCheck: true,
    });

    const model = editor.getModel();
    if (model) {
      monaco.editor.setModelLanguage(model, 'typescript');
    }

    // A hand-written subset of React's types, registered under the path Monaco
    // resolves `react` from. The real @types/react is not reachable: Monaco
    // resolves modules inside the worker, against files added here, and never
    // against the bundle's node_modules.
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      `declare module 'react' {
        export = React;
        export as namespace React;
        declare namespace React {
          type ReactNode = React.ReactElement | string | number | React.ReactNodeArray | React.ReactPortal | boolean | null | undefined;
          interface ReactElement<P = any, T extends string | React.JSXElementConstructor<any> = string | React.JSXElementConstructor<any>> {
            type: T;
            props: P;
            key: React.Key | null;
          }
          interface Component<P = {}, S = {}> {}
          interface FunctionComponent<P = {}> {
            (props: P, context?: any): ReactElement<any, any> | null;
          }
          interface HTMLAttributes<T> {
            style?: React.CSSProperties;
          }
          interface CSSProperties {
            [key: string]: string | number | undefined;
          }
        }
      }`,
      'file:///node_modules/@types/react/index.d.ts',
    );
  }, []);

  return (
    <div className="widget-playground">
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
            <LiveProvider code={code} scope={playgroundScope} noInline={true}>
              <div className="preview-container">
                <LivePreview />
                <LiveError className="error-display" />
              </div>
            </LiveProvider>
          </div>
        ) : (
          <div className="editor-panel">
            <Editor
              height={`${height}px`}
              language="typescript"
              value={code}
              onChange={handleEditorChange}
              onMount={handleEditorDidMount}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                wordWrap: 'on',
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                insertSpaces: true,
                renderWhitespace: 'selection',
                bracketPairColorization: { enabled: true },
                guides: {
                  bracketPairs: true,
                  indentation: true,
                },
                hover: {
                  // monaco 0.56 types this as 'on' | 'off' | 'onKeyboardModifier',
                  // not boolean.
                  enabled: 'on',
                  delay: 300,
                },
                suggest: {
                  showKeywords: false,
                  showSnippets: false,
                },
                // Monaco renders hover and suggestion widgets inside the editor
                // element by default, where the docs layout's own overflow and
                // stacking contexts clip anything taller than the editor. These
                // two move them to <body>, outside every such context.
                fixedOverflowWidgets: true,
                overflowWidgetsDomNode: document.body,
              }}
              theme={isDark ? 'vs-dark' : 'vs-light'}
            />
          </div>
        )}
      </div>

      {/*
        The frame, in the design system's own properties.

        Every colour here is one of the six ground roles `app/global.css` binds
        per theme, so the playground follows the site's light/dark toggle without
        a single value in this file and without a second set to keep in step. What
        is left in JS is Monaco's `theme`, which the editor takes as a prop rather
        than reading from CSS.
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
          position: relative;
          z-index: 1;
          overflow: visible;
          border-top: 1px solid var(--baize-rule);
        }

        /*
         * Hover widgets are reparented to <body> by overflowWidgetsDomNode, so
         * they inherit the page's colours instead of the editor's theme. :global
         * is what reaches them from a styled-jsx block, which otherwise scopes
         * every selector to this component's own elements.
         */
        :global(.monaco-editor .monaco-hover) {
          border: 1px solid var(--baize-rule) !important;
          border-radius: var(--baize-radius-button) !important;
          background: var(--baize-felt) !important;
          box-shadow: var(--baize-elevation-raised) !important;
        }

        :global(.monaco-editor .monaco-hover .hover-row),
        :global(.monaco-editor .monaco-hover .hover-contents),
        :global(.monaco-editor .monaco-hover .monaco-editor),
        :global(.monaco-editor .monaco-hover .monaco-editor .view-lines),
        :global(.monaco-editor .monaco-hover .monaco-editor .view-line),
        :global(.monaco-editor .monaco-hover .monaco-editor .margin) {
          background: var(--baize-felt) !important;
          color: var(--baize-chalk) !important;
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
