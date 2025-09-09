import Link from 'next/link';

export default function Examples() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <nav className="mb-8">
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            ← Back to Home
          </Link>
        </nav>

        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Examples</h1>
          
          <div className="space-y-8">
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Basic Widget Rendering</h2>
              <div className="bg-gray-100 rounded-md p-4 mb-4">
                <pre className="text-sm text-gray-800 overflow-x-auto">
{`import { createWidgets } from '@evanion/widget';

const components = {
  text: ({ content }) => <p>{content}</p>,
  image: ({ src, alt }) => <img src={src} alt={alt} />,
  card: ({ title, children, Output }) => (
    <div className="card">
      <h3>{title}</h3>
      <Output />
    </div>
  ),
};

const { Widgets } = createWidgets({ components });

const items = [
  {
    id: 'welcome',
    type: 'text',
    props: { content: 'Welcome to our app!' },
  },
  {
    id: 'hero-image',
    type: 'image',
    props: { 
      src: '/hero.jpg', 
      alt: 'Hero image' 
    },
  },
];

function App() {
  return <Widgets items={items} />;
}`}
                </pre>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Nested Widgets</h2>
              <div className="bg-gray-100 rounded-md p-4 mb-4">
                <pre className="text-sm text-gray-800 overflow-x-auto">
{`const items = [
  {
    id: 'dashboard',
    type: 'card',
    props: { title: 'Dashboard' },
    children: [
      {
        id: 'stats',
        type: 'text',
        props: { content: 'Statistics here' },
      },
      {
        id: 'chart',
        type: 'image',
        props: { 
          src: '/chart.png', 
          alt: 'Chart' 
        },
      },
    ],
  },
];`}
                </pre>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Custom Chrome Components</h2>
              <div className="bg-gray-100 rounded-md p-4 mb-4">
                <pre className="text-sm text-gray-800 overflow-x-auto">
{`const CustomWrapper = ({ children }) => (
  <div className="custom-wrapper">
    {children}
  </div>
);

const CustomItem = ({ children }) => (
  <div className="custom-item">
    {children}
  </div>
);

const { Widgets } = createWidgets({
  components,
  chrome: {
    wrapper: CustomWrapper,
    item: CustomItem,
  },
});`}
                </pre>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Error Handling</h2>
              <div className="bg-gray-100 rounded-md p-4 mb-4">
                <pre className="text-sm text-gray-800 overflow-x-auto">
{`// If a widget component throws an error, it will be caught
// and a fallback UI will be displayed
const components = {
  problematic: () => {
    throw new Error('Something went wrong!');
  },
  text: ({ content }) => <p>{content}</p>,
};`}
                </pre>
              </div>
              <p className="text-gray-600 mb-4">
                The library includes built-in error boundaries that gracefully handle widget rendering errors.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Performance Optimization</h2>
              <p className="text-gray-600 mb-4">
                The library automatically optimizes performance with:
              </p>
              <ul className="text-gray-600 mb-4 space-y-2">
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  React.memo for preventing unnecessary re-renders
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  useCallback for stable function references
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  useMemo for expensive computations
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Intelligent caching of components
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Real-World Use Cases</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Dashboard Systems</h3>
                  <p className="text-gray-600 text-sm">
                    Create dynamic dashboards where widgets can be added, removed, and configured by users.
                  </p>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">CMS Integration</h3>
                  <p className="text-gray-600 text-sm">
                    Build content management systems with flexible page layouts and component rendering.
                  </p>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Plugin Systems</h3>
                  <p className="text-gray-600 text-sm">
                    Develop extensible applications where third-party plugins can add new widget types.
                  </p>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">A/B Testing</h3>
                  <p className="text-gray-600 text-sm">
                    Easily swap different widget configurations for testing different user experiences.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
