'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { LiveProvider, LiveError, LivePreview } from 'react-live';
import { Editor } from '@monaco-editor/react';
import type { OnMount } from '@monaco-editor/react';

interface WidgetPlaygroundProps {
  /**
   * The snippet the preview starts from. It is evaluated by react-live in
   * `noInline` mode, so it has to end in a `render(<… />)` call, and every name
   * it uses has to be in `scope` below -- there is no module resolution inside
   * the snippet.
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

  /**
   * Stands in for `@evanion/react-widget`'s `createWidgets` inside the snippet.
   *
   * react-live evaluates a snippet against `scope` alone, with no module
   * resolution, so every name the examples use has to be supplied here. This
   * covers the lookup-and-render half the examples demonstrate; item validation
   * and `chrome` are not implemented, so a snippet that passes `chrome` renders
   * without it.
   */
  const mockCreateWidgets = (config: {
    components: Record<string, React.ComponentType<Record<string, unknown>>>;
  }) => {
    const { components } = config;

    const Widgets = ({
      items,
    }: {
      items: Array<{
        id: string;
        type: string;
        props: Record<string, unknown>;
      }>;
    }) => {
      return (
        <div>
          {items.map((item) => {
            const Component = components[item.type];
            if (!Component) return null;
            return (
              <div key={item.id} style={{ marginBottom: '16px' }}>
                <Component {...item.props} />
              </div>
            );
          })}
        </div>
      );
    };

    return { Widgets };
  };

  const scope = {
    createWidgets: mockCreateWidgets,
    useState: React.useState,
    useEffect: React.useEffect,
    useMemo: React.useMemo,
    useCallback: React.useCallback,
    React: React,
    // `noInline` makes react-live run the snippet as statements and render
    // whatever it hands to `render`, which it expects the scope to provide.
    render: (element: React.ReactElement) => element,
  };

  return (
    <div className="widget-playground">
      <div className="playground-header">
        <div className="playground-tabs">
          <button
            className={`tab ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveTab('preview')}
          >
            Preview
          </button>
          {showEditor && (
            <button
              className={`tab ${activeTab === 'editor' ? 'active' : ''}`}
              onClick={() => setActiveTab('editor')}
            >
              Code
            </button>
          )}
        </div>
      </div>

      <div className="playground-content">
        {activeTab === 'preview' ? (
          <div className="preview-panel">
            <LiveProvider code={code} scope={scope} noInline={true}>
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

      <style jsx>{`
        .widget-playground {
          border: 1px solid ${isDark ? '#374151' : '#e1e5e9'};
          border-radius: 8px;
          overflow: visible;
          margin: 20px 0;
          background: ${isDark ? '#1f2937' : 'white'};
          position: relative;
          z-index: 0;
        }

        .playground-header {
          background: ${isDark ? '#374151' : '#f8f9fa'};
          border-bottom: 1px solid ${isDark ? '#4b5563' : '#e1e5e9'};
          padding: 0;
        }

        .playground-tabs {
          display: flex;
        }

        .tab {
          background: none;
          border: none;
          padding: 12px 20px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          color: ${isDark ? '#9ca3af' : '#6b7280'};
          border-bottom: 2px solid transparent;
          transition: all 0.2s;
        }

        .tab:hover {
          color: ${isDark ? '#d1d5db' : '#374151'};
          background: ${
            isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
          };
        }

        .tab.active {
          color: ${isDark ? '#60a5fa' : '#2563eb'};
          border-bottom-color: ${isDark ? '#60a5fa' : '#2563eb'};
          background: ${isDark ? '#1f2937' : 'white'};
        }

        .playground-content {
          position: relative;
        }

        .preview-panel {
          padding: 20px;
          background: ${isDark ? '#111827' : '#f9f9f9'};
          min-height: ${height}px;
        }

        .preview-container {
          background: ${isDark ? '#1f2937' : 'white'};
          border-radius: 6px;
          padding: 20px;
          box-shadow: ${
            isDark
              ? '0 1px 3px rgba(0, 0, 0, 0.3)'
              : '0 1px 3px rgba(0, 0, 0, 0.1)'
          };
          color: ${isDark ? '#f9fafb' : '#111827'};
        }

        .editor-panel {
          border-top: 1px solid ${isDark ? '#4b5563' : '#e1e5e9'};
          overflow: visible;
          position: relative;
          z-index: 1;
        }

        /*
         * Hover widgets are reparented to <body> by overflowWidgetsDomNode, so
         * they inherit the page's colours instead of the editor's theme. :global
         * is what reaches them from a styled-jsx block, which otherwise scopes
         * every selector to this component's own elements.
         */
        :global(.monaco-editor .monaco-hover) {
          background: ${isDark ? '#1e1e1e' : '#ffffff'} !important;
          border: 1px solid ${isDark ? '#454545' : '#cccccc'} !important;
          border-radius: 6px !important;
          box-shadow: ${
            isDark
              ? '0 4px 12px rgba(0, 0, 0, 0.3)'
              : '0 4px 12px rgba(0, 0, 0, 0.1)'
          } !important;
        }

        :global(.monaco-editor .monaco-hover .hover-row) {
          background: ${isDark ? '#1e1e1e' : '#ffffff'} !important;
          color: ${isDark ? '#cccccc' : '#333333'} !important;
        }

        :global(.monaco-editor .monaco-hover .hover-row .hover-contents) {
          background: ${isDark ? '#1e1e1e' : '#ffffff'} !important;
          color: ${isDark ? '#cccccc' : '#333333'} !important;
        }

        :global(
          .monaco-editor .monaco-hover .hover-row .hover-contents .monaco-editor
        ) {
          background: ${isDark ? '#1e1e1e' : '#ffffff'} !important;
        }

        :global(
          .monaco-editor
            .monaco-hover
            .hover-row
            .hover-contents
            .monaco-editor
            .view-lines
        ) {
          background: ${isDark ? '#1e1e1e' : '#ffffff'} !important;
        }

        :global(
          .monaco-editor
            .monaco-hover
            .hover-row
            .hover-contents
            .monaco-editor
            .view-line
        ) {
          background: ${isDark ? '#1e1e1e' : '#ffffff'} !important;
        }

        :global(
          .monaco-editor
            .monaco-hover
            .hover-row
            .hover-contents
            .monaco-editor
            .view-line
            span
        ) {
          background: ${isDark ? '#1e1e1e' : '#ffffff'} !important;
          color: ${isDark ? '#cccccc' : '#333333'} !important;
        }

        :global(
          .monaco-editor
            .monaco-hover
            .hover-row
            .hover-contents
            .monaco-editor
            .margin
        ) {
          background: ${isDark ? '#1e1e1e' : '#ffffff'} !important;
        }

        .error-display {
          background: ${isDark ? '#7f1d1d' : '#fef2f2'};
          border: 1px solid ${isDark ? '#991b1b' : '#fecaca'};
          border-radius: 4px;
          padding: 12px;
          margin-top: 16px;
          color: ${isDark ? '#fca5a5' : '#dc2626'};
          font-family:
            'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas,
            'Courier New', monospace;
          font-size: 13px;
          white-space: pre-wrap;
        }

        @media (max-width: 768px) {
          .playground-tabs {
            flex-direction: column;
          }

          .tab {
            border-bottom: none;
            border-right: 2px solid transparent;
          }

          .tab.active {
            border-bottom-color: transparent;
            border-right-color: ${isDark ? '#60a5fa' : '#2563eb'};
          }
        }
      `}</style>
    </div>
  );
}
