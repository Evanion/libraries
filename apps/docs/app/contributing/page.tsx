import Link from 'next/link';

export default function Contributing() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <nav className="mb-8">
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            ← Back to Home
          </Link>
        </nav>

        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Contributing</h1>
          
          <p className="text-lg text-gray-600 mb-8">
            We welcome contributions to Evanion Open Source! This guide will help you get started.
          </p>

          <div className="space-y-8">
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Development Setup</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">1. Clone the repository</h3>
                  <div className="bg-gray-100 rounded-md p-4">
                    <code className="text-sm text-gray-800">
                      git clone https://github.com/evanion/open-source.git<br />
                      cd open-source
                    </code>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">2. Install dependencies</h3>
                  <div className="bg-gray-100 rounded-md p-4">
                    <code className="text-sm text-gray-800">npm install</code>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">3. Run the development server</h3>
                  <div className="bg-gray-100 rounded-md p-4">
                    <code className="text-sm text-gray-800">nx serve docs</code>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Commit Standards</h2>
              <p className="text-gray-600 mb-4">
                This project uses conventional commits and automated tooling:
              </p>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Using Commitizen</h3>
                  <div className="bg-gray-100 rounded-md p-4 mb-4">
                    <code className="text-sm text-gray-800">npm run commit</code>
                  </div>
                  <p className="text-gray-600">
                    This interactive tool will guide you through creating properly formatted commit messages.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Commit Message Format</h3>
                  <div className="bg-gray-100 rounded-md p-4 mb-4">
                    <pre className="text-sm text-gray-800">
{`<type>(<scope>): <description>

[optional body]

[optional footer(s)]`}
                    </pre>
                  </div>
                  
                  <h4 className="font-semibold text-gray-900 mb-2">Types:</h4>
                  <ul className="text-gray-600 mb-4 space-y-1">
                    <li><code className="bg-gray-100 px-2 py-1 rounded">feat</code>: A new feature</li>
                    <li><code className="bg-gray-100 px-2 py-1 rounded">fix</code>: A bug fix</li>
                    <li><code className="bg-gray-100 px-2 py-1 rounded">docs</code>: Documentation changes</li>
                    <li><code className="bg-gray-100 px-2 py-1 rounded">style</code>: Code style changes (formatting, etc.)</li>
                    <li><code className="bg-gray-100 px-2 py-1 rounded">refactor</code>: Code refactoring</li>
                    <li><code className="bg-gray-100 px-2 py-1 rounded">test</code>: Adding or updating tests</li>
                    <li><code className="bg-gray-100 px-2 py-1 rounded">chore</code>: Maintenance tasks</li>
                  </ul>

                  <h4 className="font-semibold text-gray-900 mb-2">Examples:</h4>
                  <div className="bg-gray-100 rounded-md p-4">
                    <pre className="text-sm text-gray-800">
{`feat(widget): Add nested widget support
fix(docs): Correct API documentation
docs: Update getting started guide`}
                    </pre>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Pre-commit Hooks</h2>
              <p className="text-gray-600 mb-4">
                The project uses Husky to run pre-commit checks:
              </p>
              <ul className="text-gray-600 mb-4 space-y-2">
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  <strong>Linting</strong>: Automatically runs on affected projects only
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  <strong>Commit Message Validation</strong>: Ensures conventional commit format
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Testing</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Run tests for affected projects:</h3>
                  <div className="bg-gray-100 rounded-md p-4">
                    <code className="text-sm text-gray-800">nx affected --target=test</code>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Run tests for all projects:</h3>
                  <div className="bg-gray-100 rounded-md p-4">
                    <code className="text-sm text-gray-800">nx run-many --target=test --all</code>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Building</h2>
              <div className="bg-gray-100 rounded-md p-4">
                <code className="text-sm text-gray-800">nx run-many --target=build --all</code>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Pull Request Process</h2>
              <ol className="text-gray-600 space-y-2">
                <li>1. Create a feature branch from <code className="bg-gray-100 px-2 py-1 rounded">main</code></li>
                <li>2. Make your changes</li>
                <li>3. Ensure all tests pass</li>
                <li>4. Commit using conventional commit format</li>
                <li>5. Push your branch</li>
                <li>6. Create a pull request</li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Code Style</h2>
              <ul className="text-gray-600 space-y-2">
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Use TypeScript for all new code
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Follow the existing ESLint configuration
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Write tests for new features
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Update documentation as needed
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Questions?</h2>
              <p className="text-gray-600 mb-4">
                Feel free to open an issue for questions or discussions!
              </p>
              <a 
                href="https://github.com/evanion/open-source/issues" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Open an Issue →
              </a>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
