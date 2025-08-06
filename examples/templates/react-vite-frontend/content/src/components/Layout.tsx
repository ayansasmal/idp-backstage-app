import { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface LayoutProps {
    children: ReactNode
}

export function Layout({ children }: LayoutProps) {
    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center">
                            <Link to="/" className="text-xl font-bold text-gray-900">
                                ${{ values.name }}
                            </Link>
                        </div>
                        <nav className="flex space-x-8">
                            <Link
                                to="/"
                                className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                            >
                                Home
                            </Link>
                            <Link
                                to="/about"
                                className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                            >
                                About
                            </Link>
                        </nav>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="px-4 py-6 sm:px-0">
                    {children}
                </div>
            </main>

            <footer className="bg-white border-t mt-auto">
                <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
                    <p className="text-center text-sm text-gray-500">
                        Built with React + Vite | Powered by IDP Platform
                    </p>
                </div>
            </footer>
        </div>
    )
}
