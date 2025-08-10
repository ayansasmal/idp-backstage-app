#!/bin/bash

# Load environment variables for GitHub authentication
echo "🔐 Loading GitHub OAuth environment variables..."

export GITHUB_CLIENT_ID="Ov23lig5ZN6AwksrqMJr"
export GITHUB_CLIENT_SECRET="57bbed8b53cfbf7db08c0c26a5df45dc9182b44a"
export BACKEND_SECRET="your-secret-key-for-sessions-replace-in-production"
export LOG_LEVEL="debug"
export NODE_ENV="development"

echo "✅ Environment variables loaded:"
echo "   AUTH_GITHUB_CLIENT_ID=$AUTH_GITHUB_CLIENT_ID"
echo "   AUTH_GITHUB_CLIENT_SECRET=***"
echo "   BACKEND_SECRET=***"
echo "   LOG_LEVEL=$LOG_LEVEL"
echo ""

echo "🚀 Starting Backstage with GitHub authentication..."
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:7007"
echo "   OAuth2 Provider: GitHub"
echo ""

# Start Backstage
yarn start