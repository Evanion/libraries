import Link from 'next/link';

export default function Index() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            📚 Evanion Open Source
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Welcome to the documentation for Evanion's open source libraries and tools.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                <span className="text-2xl">🧩</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">@evanion/widget</h2>
            </div>
            <p className="text-gray-600 mb-4">
              A powerful React library for dynamic widget rendering with support for:
            </p>
            <ul className="text-gray-600 mb-6 space-y-2">
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Dynamic Component Rendering
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Nested Widgets
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Error Boundaries
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Performance Optimized
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                TypeScript Support
              </li>
            </ul>
            <Link 
              href="/widget/getting-started" 
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Get Started →
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                <span className="text-2xl">🚀</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Quick Start</h2>
            </div>
            <p className="text-gray-600 mb-4">
              Get up and running with our libraries in minutes:
            </p>
            <div className="bg-gray-100 rounded-md p-4 mb-4">
              <code className="text-sm text-gray-800">
                npm install @evanion/widget
              </code>
            </div>
            <p className="text-gray-600 mb-4">
              Then follow our comprehensive guides to integrate widgets into your React applications.
            </p>
            <Link 
              href="/widget/examples" 
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              View Examples →
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Available Libraries</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">@evanion/widget</h3>
              <p className="text-gray-600 text-sm mb-3">
                Dynamic widget rendering system for React applications
              </p>
              <div className="flex space-x-2">
                <Link 
                  href="/widget/getting-started" 
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  Getting Started
                </Link>
                <span className="text-gray-300">•</span>
                <Link 
                  href="/widget/api" 
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  API Reference
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Contributing</h2>
          <p className="text-gray-600 mb-4">
            We welcome contributions! Please see our contributing guide for details on how to get involved.
          </p>
          <div className="flex space-x-4">
            <Link 
              href="/contributing" 
              className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              Contributing Guide →
            </Link>
            <a 
              href="https://github.com/evanion/open-source" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              View on GitHub →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}