#!/bin/bash

# Environment Setup Script for IDP Backstage App
# This script helps set up the required environment variables

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if .env file exists
if [[ -f ".env" ]]; then
    print_warning ".env file already exists!"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Keeping existing .env file"
        exit 0
    fi
fi

print_status "Setting up environment configuration for IDP Backstage App"
echo

# Copy example file
if [[ ! -f ".env.example" ]]; then
    print_error ".env.example file not found!"
    exit 1
fi

cp .env.example .env
print_success "Created .env file from template"

# Generate a secure backend secret
BACKEND_SECRET=$(openssl rand -base64 48 2>/dev/null || python3 -c "import secrets; print(secrets.token_urlsafe(48))" 2>/dev/null || echo "PLEASE-GENERATE-A-SECURE-RANDOM-SECRET-AT-LEAST-32-CHARS")

# Update .env with generated secret
if command -v sed >/dev/null 2>&1; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/your-secure-backend-secret-at-least-32-chars/$BACKEND_SECRET/" .env
    else
        # Linux
        sed -i "s/your-secure-backend-secret-at-least-32-chars/$BACKEND_SECRET/" .env
    fi
    print_success "Generated and set BACKEND_SECRET"
else
    print_warning "Could not automatically set BACKEND_SECRET. Please set it manually in .env"
fi

echo
print_status "Environment file created! Now you need to configure:"
print_warning "REQUIRED for OAuth2 functionality:"
echo "  - GITHUB_TOKEN (Personal Access Token)"
echo "  - GITHUB_CLIENT_ID (OAuth App Client ID)" 
echo "  - GITHUB_CLIENT_SECRET (OAuth App Client Secret)"
echo
print_warning "REQUIRED for database connectivity:"
echo "  - POSTGRES_HOST (your AWS RDS endpoint)"
echo "  - POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB"
echo
print_status "Edit the .env file with your actual values:"
echo "  nano .env    # or use your preferred editor"
echo
print_status "After configuration, deploy with:"
echo "  ./deploy.sh fullstack"
echo

print_success "Setup complete! Don't forget to configure your values in .env"