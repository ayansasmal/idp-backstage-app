# ${{ values.name }}

${{ values.description }}

This is a React frontend application built with Vite, created from the IDP platform template.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:${{ values.port }}`

### Building for Production

```bash
# Build the application
npm run build

# Preview the production build
npm run preview
```

## 🧪 Testing

```bash
# Run tests
npm run test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## 🔧 Development

### Project Structure

```
src/
├── components/     # Reusable UI components
├── pages/         # Route-based page components
├── hooks/         # Custom React hooks
├── services/      # API service layer
├── types/         # TypeScript type definitions
├── utils/         # Utility functions
└── test/          # Test setup and utilities
```

### API Configuration

The application is configured to connect to the backend API at:

- Development: `${{ values.apiBaseUrl }}`
- Production: Configure via environment variables

### Code Quality

- **ESLint**: Linting with TypeScript support
- **Prettier**: Code formatting (run with `npm run lint:fix`)
- **TypeScript**: Strict type checking
- **Vitest**: Testing framework with React Testing Library

## 📦 Built With

- **React 18** - Frontend framework
- **Vite** - Build tool and development server
- **TypeScript** - Type safety
- **React Router** - Client-side routing
- **Axios** - HTTP client
- **Zustand** - State management
- **Vitest** - Testing framework

## 🔗 Links

- [Backstage Component](${{ 'https://your-backstage-url.com/catalog/default/component/' + values.name }})
- [Repository](${{ values.repoUrl }})

## 👥 Ownership

**Owner:** ${{ values.owner }}

For questions or support, please contact the component owner or the platform team.
