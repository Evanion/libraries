import Link from 'next/link';

export default function API() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <nav className="mb-8">
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            ← Back to Home
          </Link>
        </nav>

        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">API Reference</h1>
          
          <div className="space-y-8">
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">createWidgets</h2>
              <p className="text-gray-600 mb-4">
                Creates a widget system with the provided configuration.
              </p>
              <div className="bg-gray-100 rounded-md p-4 mb-4">
                <pre className="text-sm text-gray-800">
{`const { Widgets, WidgetsProvider, useWidgets, Output } = createWidgets(config);`}
                </pre>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Parameters</h3>
              <ul className="text-gray-600 mb-4 space-y-2">
                <li><code className="bg-gray-100 px-2 py-1 rounded">config.components</code> - Object mapping widget types to React components</li>
                <li><code className="bg-gray-100 px-2 py-1 rounded">config.chrome</code> - Optional chrome components for styling</li>
                <li><code className="bg-gray-100 px-2 py-1 rounded">config.context</code> - Optional React context for component sharing</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-900 mb-2">Returns</h3>
              <ul className="text-gray-600 mb-4 space-y-2">
                <li><code className="bg-gray-100 px-2 py-1 rounded">Widgets</code> - Component for rendering widget lists</li>
                <li><code className="bg-gray-100 px-2 py-1 rounded">WidgetsProvider</code> - Context provider for sharing components</li>
                <li><code className="bg-gray-100 px-2 py-1 rounded">useWidgets</code> - Hook for accessing components from context</li>
                <li><code className="bg-gray-100 px-2 py-1 rounded">Output</code> - Component for rendering nested widgets</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">WidgetProps</h2>
              <p className="text-gray-600 mb-4">
                Type definition for individual widget items.
              </p>
              <div className="bg-gray-100 rounded-md p-4 mb-4">
                <pre className="text-sm text-gray-800">
{`interface WidgetProps<Type extends string> {
  id: string;
  type: Type;
  props: Record<string, unknown>;
  children?: WidgetProps<string>[];
}`}
                </pre>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Widgets Component</h2>
              <p className="text-gray-600 mb-4">
                Renders a list of widgets.
              </p>
              <div className="bg-gray-100 rounded-md p-4 mb-4">
                <pre className="text-sm text-gray-800">
{`<Widgets 
  items={WidgetProps[]} 
  components={ComponentMap} 
  chrome={ChromeConfig} 
/>`}
                </pre>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Props</h3>
              <ul className="text-gray-600 mb-4 space-y-2">
                <li><code className="bg-gray-100 px-2 py-1 rounded">items</code> - Array of widget items to render</li>
                <li><code className="bg-gray-100 px-2 py-1 rounded">components</code> - Optional component overrides for this instance</li>
                <li><code className="bg-gray-100 px-2 py-1 rounded">chrome</code> - Optional chrome overrides for this instance</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Output Component</h2>
              <p className="text-gray-600 mb-4">
                Renders nested widgets from context.
              </p>
              <div className="bg-gray-100 rounded-md p-4 mb-4">
                <pre className="text-sm text-gray-800">
{`<Output items={WidgetProps[]} />`}
                </pre>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Props</h3>
              <ul className="text-gray-600 mb-4 space-y-2">
                <li><code className="bg-gray-100 px-2 py-1 rounded">items</code> - Array of nested widget items (optional)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">useWidgets Hook</h2>
              <p className="text-gray-600 mb-4">
                Accesses widget components from context.
              </p>
              <div className="bg-gray-100 rounded-md p-4 mb-4">
                <pre className="text-sm text-gray-800">
{`const components = useWidgets();`}
                </pre>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Returns</h3>
              <p className="text-gray-600 mb-4">
                Object mapping widget types to React components.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
