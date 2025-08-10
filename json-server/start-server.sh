#!/bin/bash

# Start the JSON server for organization data
echo "Starting JSON server for organization data..."
cd "$(dirname "$0")"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Start the server
echo "JSON server starting on http://localhost:3001"
echo "Organization data available at: http://localhost:3001/organizations"
npm start
