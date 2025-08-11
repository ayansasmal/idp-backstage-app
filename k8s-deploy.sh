#!/bin/bash

# Kubernetes Deployment Script for IDP Backstage App
# This script deploys Backstage to the IDP Kubernetes platform

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[K8S-DEPLOY]${NC} $1"
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

show_help() {
    cat << EOF
IDP Backstage Kubernetes Deployment Script

Usage: ./k8s-deploy.sh [OPTIONS] ACTION

ACTIONS:
  deploy        - Deploy all Backstage components to Kubernetes
  build         - Build and push Docker images using Argo Workflows  
  webapplication - Deploy using IDP WebApplication CRD (recommended)
  cleanup       - Remove all Backstage components from Kubernetes
  status        - Check deployment status

OPTIONS:
  -n, --namespace NAMESPACE  - Kubernetes namespace (default: backstage)
  -i, --image-tag TAG       - Docker image tag (default: latest)
  -r, --registry URL        - Container registry URL
  -h, --help               - Show this help message

EXAMPLES:
  ./k8s-deploy.sh deploy                    # Deploy with defaults
  ./k8s-deploy.sh webapplication           # Deploy with WebApplication CRD
  ./k8s-deploy.sh build -i v1.2.3         # Build images with tag v1.2.3
  ./k8s-deploy.sh status                   # Check deployment status

PREREQUISITES:
  - kubectl configured and connected to IDP cluster
  - Docker images built and pushed to registry
  - Secrets configured (see k8s/secret-template.yaml)

EOF
}

# Default values
ACTION=""
NAMESPACE="backstage"
IMAGE_TAG="latest"
REGISTRY_URL="000000000000.dkr.ecr.us-east-1.localhost.localstack.cloud:4566"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -i|--image-tag)
            IMAGE_TAG="$2"
            shift 2
            ;;
        -r|--registry)
            REGISTRY_URL="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        deploy|build|webapplication|cleanup|status)
            ACTION="$1"
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

if [[ -z "$ACTION" ]]; then
    print_error "Action is required"
    show_help
    exit 1
fi

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed"
        exit 1
    fi
    
    # Check cluster connection
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Deploy using standard Kubernetes manifests
deploy_standard() {
    print_status "Deploying Backstage using standard Kubernetes manifests..."
    
    # Apply manifests in order
    kubectl apply -f k8s/namespace.yaml
    kubectl apply -f k8s/serviceaccount.yaml
    kubectl apply -f k8s/configmap-env.yaml
    kubectl apply -f k8s/configmap.yaml
    
    # Check if secret exists
    if ! kubectl get secret backstage-secrets -n $NAMESPACE &> /dev/null; then
        print_warning "Secret 'backstage-secrets' not found in namespace '$NAMESPACE'"
        print_warning "Please create the secret using k8s/secret-template.yaml"
        print_warning "kubectl apply -f k8s/secret-template.yaml"
    fi
    
    # Deploy services and deployments
    kubectl apply -f k8s/service-backend.yaml
    kubectl apply -f k8s/service-frontend.yaml
    kubectl apply -f k8s/deployment-backend.yaml
    kubectl apply -f k8s/deployment-frontend.yaml
    
    # Apply Istio configuration if available
    if kubectl get crd virtualservices.networking.istio.io &> /dev/null; then
        kubectl apply -f k8s/istio-virtualservice.yaml
        print_success "Applied Istio configuration"
    else
        print_warning "Istio not detected, skipping VirtualService"
    fi
    
    print_success "Standard deployment completed"
}

# Deploy using WebApplication CRD
deploy_webapplication() {
    print_status "Deploying Backstage using WebApplication CRD..."
    
    # Apply prerequisites
    kubectl apply -f k8s/namespace.yaml
    kubectl apply -f k8s/serviceaccount.yaml
    kubectl apply -f k8s/configmap-env.yaml
    kubectl apply -f k8s/configmap.yaml
    
    # Check if WebApplication CRD exists
    if ! kubectl get crd webapplications.idp.platform &> /dev/null; then
        print_error "WebApplication CRD not found"
        print_error "This requires the IDP platform operator to be installed"
        exit 1
    fi
    
    # Check if secret exists
    if ! kubectl get secret backstage-secrets -n $NAMESPACE &> /dev/null; then
        print_warning "Secret 'backstage-secrets' not found"
        print_warning "Please create the secret first"
        exit 1
    fi
    
    # Apply WebApplication
    kubectl apply -f k8s/webapplication.yaml
    
    print_success "WebApplication deployment completed"
}

# Build images using Argo Workflows
build_images() {
    print_status "Building Docker images using Argo Workflows..."
    
    # Check if Argo Workflows is available
    if ! kubectl get crd workflows.argoproj.io &> /dev/null; then
        print_error "Argo Workflows not found"
        exit 1
    fi
    
    # Submit workflow
    argo submit argo-workflows/build-workflow.yaml \
        -p image-tag="$IMAGE_TAG" \
        -p registry-url="$REGISTRY_URL" \
        --wait
    
    print_success "Image build completed with tag: $IMAGE_TAG"
}

# Check deployment status
check_status() {
    print_status "Checking Backstage deployment status..."
    
    echo
    print_status "Namespace:"
    kubectl get namespace $NAMESPACE 2>/dev/null || print_warning "Namespace not found"
    
    echo
    print_status "Deployments:"
    kubectl get deployments -n $NAMESPACE 2>/dev/null || print_warning "No deployments found"
    
    echo
    print_status "Services:"
    kubectl get services -n $NAMESPACE 2>/dev/null || print_warning "No services found"
    
    echo
    print_status "Pods:"
    kubectl get pods -n $NAMESPACE 2>/dev/null || print_warning "No pods found"
    
    # Check WebApplication if it exists
    if kubectl get crd webapplications.idp.platform &> /dev/null; then
        echo
        print_status "WebApplication:"
        kubectl get webapplication -n $NAMESPACE 2>/dev/null || print_warning "No WebApplication found"
    fi
    
    # Check Istio resources
    if kubectl get crd virtualservices.networking.istio.io &> /dev/null; then
        echo
        print_status "Istio VirtualServices:"
        kubectl get virtualservices -n $NAMESPACE 2>/dev/null || print_warning "No VirtualServices found"
    fi
}

# Cleanup deployment
cleanup() {
    print_status "Cleaning up Backstage deployment..."
    
    # Delete in reverse order
    kubectl delete -f k8s/webapplication.yaml --ignore-not-found=true
    kubectl delete -f k8s/istio-virtualservice.yaml --ignore-not-found=true
    kubectl delete -f k8s/deployment-frontend.yaml --ignore-not-found=true
    kubectl delete -f k8s/deployment-backend.yaml --ignore-not-found=true
    kubectl delete -f k8s/service-frontend.yaml --ignore-not-found=true
    kubectl delete -f k8s/service-backend.yaml --ignore-not-found=true
    kubectl delete -f k8s/configmap.yaml --ignore-not-found=true
    kubectl delete -f k8s/configmap-env.yaml --ignore-not-found=true
    kubectl delete -f k8s/serviceaccount.yaml --ignore-not-found=true
    
    # Optional: Delete namespace (commented out for safety)
    # kubectl delete -f k8s/namespace.yaml --ignore-not-found=true
    
    print_success "Cleanup completed"
}

# Main execution
check_prerequisites

case $ACTION in
    deploy)
        deploy_standard
        ;;
    webapplication)
        deploy_webapplication
        ;;
    build)
        build_images
        ;;
    status)
        check_status
        ;;
    cleanup)
        cleanup
        ;;
    *)
        print_error "Unknown action: $ACTION"
        exit 1
        ;;
esac

print_success "Action '$ACTION' completed successfully!"