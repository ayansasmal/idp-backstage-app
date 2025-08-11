#!/bin/bash

# IDP Backstage App Deployment Script
# This script provides different deployment options for the Backstage application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
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

# Show usage
show_help() {
    cat << EOF
IDP Backstage App Deployment Script

Usage: ./deploy.sh [OPTIONS] DEPLOYMENT_TYPE

DEPLOYMENT_TYPES:
  fullstack     - Single container with both frontend (port 3000) and backend (port 7007)
  microservices - Separate containers for frontend and backend
  backend-only  - Backend container only (port 7007)
  build-only    - Build containers without running them

OPTIONS:
  -h, --help    - Show this help message
  -c, --clean   - Clean existing containers and images before deploying
  -d, --detach  - Run in detached mode (background)
  -u, --unleash - Include Unleash OSS feature flags service
  --build       - Force rebuild of images

EXAMPLES:
  ./deploy.sh fullstack              # Run full Backstage app in single container
  ./deploy.sh microservices -u      # Run with separate services + Unleash
  ./deploy.sh backend-only -d       # Run backend only in background
  ./deploy.sh build-only             # Just build the containers

KUBERNETES DEPLOYMENT:
  For production Kubernetes deployment on the IDP platform:
    ./k8s-deploy.sh webapplication   # Deploy using WebApplication CRD (recommended)
    ./k8s-deploy.sh deploy            # Deploy using standard Kubernetes manifests
    ./k8s-deploy.sh build             # Build images using Argo Workflows

  See K8S-DEPLOYMENT.md for detailed Kubernetes deployment guide.

ENVIRONMENT CONFIGURATION:
  The application requires various environment variables for proper operation.
  
  REQUIRED for OAuth2/GitHub integration:
    - BACKEND_SECRET (at least 32 characters)
    - GITHUB_TOKEN, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
  
  For external AWS RDS:
    - POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
  
  Setup options:
    1. Copy .env.example to .env and fill in your values
    2. Export environment variables in your shell
    3. Use your platform's secret management (recommended for production)
  
  See .env.example for complete list of available configuration options.

EOF
}

# Default options
DEPLOYMENT_TYPE=""
CLEAN=false
DETACH=false
UNLEASH=false
BUILD=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -c|--clean)
            CLEAN=true
            shift
            ;;
        -d|--detach)
            DETACH=true
            shift
            ;;
        -u|--unleash)
            UNLEASH=true
            shift
            ;;
        --build)
            BUILD=true
            shift
            ;;
        fullstack|microservices|backend-only|build-only)
            DEPLOYMENT_TYPE=$1
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Check if deployment type is provided
if [[ -z "$DEPLOYMENT_TYPE" ]]; then
    print_error "Deployment type is required"
    show_help
    exit 1
fi

# Check for important environment variables
check_env_vars() {
    local missing_vars=()
    
    # Check for critical OAuth2/GitHub variables
    [[ -z "$BACKEND_SECRET" ]] && missing_vars+=("BACKEND_SECRET")
    [[ -z "$GITHUB_TOKEN" ]] && missing_vars+=("GITHUB_TOKEN") 
    [[ -z "$GITHUB_CLIENT_ID" ]] && missing_vars+=("GITHUB_CLIENT_ID")
    [[ -z "$GITHUB_CLIENT_SECRET" ]] && missing_vars+=("GITHUB_CLIENT_SECRET")
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        print_warning "Missing important environment variables:"
        for var in "${missing_vars[@]}"; do
            print_warning "  - $var"
        done
        print_warning "OAuth2/GitHub integration may not work properly."
        print_warning "Consider creating a .env file from .env.example"
        echo
    fi
    
    # Check for database configuration
    if [[ -n "$POSTGRES_HOST" ]]; then
        print_status "Using external database: $POSTGRES_HOST"
    else
        print_status "No POSTGRES_HOST set - using application defaults"
    fi
}

# Check environment variables before deployment
check_env_vars

# Clean up existing containers and images if requested
if [[ "$CLEAN" == true ]]; then
    print_status "Cleaning existing containers and images..."
    docker-compose down --remove-orphans --volumes 2>/dev/null || true
    docker system prune -f
    print_success "Cleanup completed"
fi

# Set up build args
BUILD_ARGS=""
if [[ "$BUILD" == true ]]; then
    BUILD_ARGS="--build"
fi

# Set up profiles
PROFILES=""
case $DEPLOYMENT_TYPE in
    fullstack)
        PROFILES="fullstack"
        if [[ "$UNLEASH" == true ]]; then
            PROFILES="$PROFILES,unleash"
        fi
        ;;
    microservices)
        PROFILES="microservices"
        if [[ "$UNLEASH" == true ]]; then
            PROFILES="$PROFILES,unleash"
        fi
        ;;
    backend-only)
        PROFILES="microservices"
        ;;
    build-only)
        print_status "Building all container images..."
        docker-compose build
        print_success "All images built successfully"
        exit 0
        ;;
esac

# Set up detach mode
DETACH_ARGS=""
if [[ "$DETACH" == true ]]; then
    DETACH_ARGS="-d"
fi

# Deploy based on type
print_status "Deploying Backstage app with profile: $PROFILES"

case $DEPLOYMENT_TYPE in
    fullstack)
        print_status "Starting full-stack Backstage (frontend + backend in single container)"
        docker-compose --profile $PROFILES up $BUILD_ARGS $DETACH_ARGS
        if [[ "$DETACH" == false ]]; then
            print_success "Full-stack Backstage started successfully"
            print_status "Frontend available at: http://localhost:3000"
            print_status "Backend API available at: http://localhost:7007"
            if [[ "$UNLEASH" == true ]]; then
                print_status "Unleash available at: http://localhost:4242 (admin/unleash4all)"
            fi
        fi
        ;;
    microservices)
        print_status "Starting Backstage microservices (separate frontend and backend)"
        if [[ "$UNLEASH" == true ]]; then
            print_status "Including Unleash OSS feature flags service"
        fi
        docker-compose --profile $PROFILES up $BUILD_ARGS $DETACH_ARGS
        if [[ "$DETACH" == false ]]; then
            print_success "Backstage microservices started successfully"
            print_status "Frontend available at: http://localhost:3000"
            print_status "Backend API available at: http://localhost:7007"
            if [[ "$UNLEASH" == true ]]; then
                print_status "Unleash available at: http://localhost:4242 (admin/unleash4all)"
            fi
        fi
        ;;
    backend-only)
        print_status "Starting backend service only"
        docker-compose --profile microservices up backstage-backend postgres $BUILD_ARGS $DETACH_ARGS
        if [[ "$DETACH" == false ]]; then
            print_success "Backend service started successfully"
            print_status "Backend API available at: http://localhost:7007"
            print_status "Health check: http://localhost:7007/api/unleash-feature-flags/health/status"
        fi
        ;;
esac

if [[ "$DETACH" == true ]]; then
    print_success "Services started in background mode"
    print_status "Use 'docker-compose logs -f' to view logs"
    print_status "Use 'docker-compose down' to stop services"
fi

print_success "Deployment completed!"