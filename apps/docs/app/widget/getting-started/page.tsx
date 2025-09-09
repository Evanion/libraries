import Link from 'next/link';

export default function GettingStarted() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <nav className="mb-8">
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            ← Back to Home
          </Link>
        </nav>

        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            Getting Started with @evanion/widget
          </h1>
          
          <p className="text-lg text-gray-600 mb-8">
            The <code className="bg-gray-100 px-2 py-1 rounded">@evanion/widget</code> library provides a powerful system for dynamic widget rendering in React applications.
          </p>

          <div className="space-y-8">
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Installation</h2>
              <div className="bg-gray-100 rounded-md p-4">
                <code className="text-sm text-gray-800">npm install @evanion/widget</code>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Basic Usage</h2>
              <div className="bg-gray-100 rounded-md p-4 mb-4">
                <pre className="text-sm text-gray-800 overflow-x-auto">
{`import { createWidgets } from '@evanion/widget';

// Define your widget components
const components = {
  text: ({ content }) => <p>{content}</p>,
  button: ({ label, onClick }) => <button onClick={onClick}>{label}</button>,
};

// Create the widget system
const { Widgets } = createWidgets({ components });

// Define your widget data
const items = [
  {
    id: 'welcome',
    type: 'text',
    props: { content: 'Hello, World!' },
  },
  {
    id: 'action',
    type: 'button',
    props: { 
      label: 'Click me',
      onClick: () => console.log('Button clicked!')
    },
  },
];

// Render the widgets
function App() {
  return <Widgets items={items} />;
}`}
                </pre>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Key Features</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Dynamic Rendering</h3>
                  <p className="text-gray-600 text-sm">
                    Components are rendered based on configuration, allowing for flexible and data-driven UIs.
                  </p>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Type Safety</h3>
                  <p className="text-gray-600 text-sm">
                    Full TypeScript support with proper type inference and IntelliSense.
                  </p>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Nested Widgets</h3>
                  <p className="text-gray-600 text-sm">
                    Support for hierarchical widget structures with the Output component.
                  </p>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Error Handling</h3>
                  <p className="text-gray-600 text-sm">
                    Built-in error boundaries and graceful fallbacks for robust applications.
                  </p>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Performance</h3>
                  <p className="text-gray-600 text-sm">
                    Optimized with React.memo and intelligent caching to prevent unnecessary re-renders.
                  </p>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Flexible</h3>
                  <p className="text-gray-600 text-sm">
                    Customizable chrome components and instance-specific overrides.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Next Steps</h2>
              <div className="flex space-x-4">
                <Link 
                  href="/widget/api" 
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  API Reference →
                </Link>
                <Link 
                  href="/widget/examples" 
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  Examples →
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
