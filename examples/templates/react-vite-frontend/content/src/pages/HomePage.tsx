export function HomePage() {
    return (
        <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-8">
                Welcome to ${{ values.name }}
            </h1>

            <div className="max-w-3xl mx-auto">
                <p className="text-xl text-gray-600 mb-8">
                    ${{ values.description }}
                </p>

                <div className="grid md:grid-cols-2 gap-8 mt-12">
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">
                            🚀 Fast Development
                        </h2>
                        <p className="text-gray-600">
                            Built with Vite for lightning-fast development experience with hot module replacement.
                        </p>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">
                            🔒 Type Safe
                        </h2>
                        <p className="text-gray-600">
                            TypeScript throughout the application for better developer experience and fewer bugs.
                        </p>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">
                            🧪 Well Tested
                        </h2>
                        <p className="text-gray-600">
                            Comprehensive testing setup with Vitest and React Testing Library.
                        </p>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">
                            📦 Modern Stack
                        </h2>
                        <p className="text-gray-600">
                            Latest React 18 features with modern development tools and best practices.
                        </p>
                    </div>
                </div>

                <div className="mt-12">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">
                        API Configuration
                    </h2>
                    <div className="bg-gray-100 p-4 rounded-lg">
                        <p className="text-sm text-gray-600 mb-2">Backend API URL:</p>
                        <code className="text-sm bg-white px-2 py-1 rounded">
                            ${{ values.apiBaseUrl }}
                        </code>
                    </div>
                </div>
            </div>
        </div>
    )
}
