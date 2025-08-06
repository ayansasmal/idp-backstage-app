export function AboutPage() {
    return (
        <div className="max-w-3xl mx-auto">
            <h1 className="text-4xl font-bold text-gray-900 mb-8">
                About ${{ values.name }}
            </h1>

            <div className="prose prose-lg">
                <p className="text-xl text-gray-600 mb-8">
                    ${{ values.description }}
                </p>

                <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                    <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                        Project Information
                    </h2>
                    <div className="space-y-3">
                        <div>
                            <span className="font-medium text-gray-700">Owner:</span>
                            <span className="ml-2 text-gray-600">${{ values.owner }}</span>
                        </div>
                        <div>
                            <span className="font-medium text-gray-700">Development Port:</span>
                            <span className="ml-2 text-gray-600">${{ values.port }}</span>
                        </div>
                        <div>
                            <span className="font-medium text-gray-700">API Base URL:</span>
                            <span className="ml-2 text-gray-600">${{ values.apiBaseUrl }}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-blue-50 p-6 rounded-lg mb-8">
                    <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                        Technology Stack
                    </h2>
                    <ul className="list-disc list-inside space-y-2 text-gray-700">
                        <li>React 18 with TypeScript</li>
                        <li>Vite for fast development and building</li>
                        <li>React Router for client-side routing</li>
                        <li>Axios for HTTP requests</li>
                        <li>Zustand for state management</li>
                        <li>Vitest for testing</li>
                        <li>ESLint and Prettier for code quality</li>
                    </ul>
                </div>

                <div className="bg-green-50 p-6 rounded-lg">
                    <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                        Getting Help
                    </h2>
                    <p className="text-gray-700 mb-4">
                        This application was generated using the IDP platform's React + Vite template.
                        For support and questions:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-gray-700">
                        <li>Contact the component owner: <strong>${{ values.owner }}</strong></li>
                        <li>Check the project documentation in the repository</li>
                        <li>Reach out to the platform team for template-related issues</li>
                    </ul>
                </div>
            </div>
        </div>
    )
}
