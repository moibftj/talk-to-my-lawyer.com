#!/bin/bash

# Stripe Webhook Setup Script for Local Development
# This script sets up Stripe CLI webhook forwarding for the Talk-To-My-Lawyer platform

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Check if .env.local exists and has STRIPE_SECRET_KEY
check_env_file() {
    if [ ! -f ".env.local" ]; then
        print_error ".env.local file not found!"
        print_error "Please create .env.local with your Stripe configuration."
        print_error "See docs/STRIPE_SETUP.md for instructions."
        exit 1
    fi

    if ! grep -q "STRIPE_SECRET_KEY=" .env.local; then
        print_error "STRIPE_SECRET_KEY not found in .env.local"
        print_error "Please add your Stripe secret key to .env.local"
        exit 1
    fi

    # Extract the secret key
    STRIPE_SECRET_KEY=$(grep "STRIPE_SECRET_KEY=" .env.local | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    
    if [ -z "$STRIPE_SECRET_KEY" ] || [ "$STRIPE_SECRET_KEY" = "sk_test_YOUR_SECRET_KEY_HERE" ]; then
        print_error "STRIPE_SECRET_KEY is not set to a real value in .env.local"
        print_error "Please update .env.local with your actual Stripe secret key"
        exit 1
    fi
}

# Check if Stripe CLI is installed
check_stripe_cli() {
    if ! command -v stripe &> /dev/null; then
        print_error "Stripe CLI is not installed!"
        print_error "Please install it first:"
        print_error "  macOS: brew install stripe/stripe-cli/stripe"
        print_error "  Linux: Download from https://github.com/stripe/stripe-cli/releases"
        exit 1
    fi

    STRIPE_VERSION=$(stripe --version)
    print_success "Stripe CLI found: $STRIPE_VERSION"
}

# Check if development server is running
check_dev_server() {
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        print_success "Development server is running on http://localhost:3000"
    else
        print_warning "Development server doesn't appear to be running"
        print_warning "Make sure to start it with: pnpm dev"
        print_warning "Continuing anyway - you can start the server later"
    fi
}

# Login to Stripe
stripe_login() {
    print_status "Authenticating with Stripe..."
    
    if stripe login --api-key "$STRIPE_SECRET_KEY" > /dev/null 2>&1; then
        print_success "Successfully authenticated with Stripe"
    else
        print_error "Failed to authenticate with Stripe"
        print_error "Please check your STRIPE_SECRET_KEY in .env.local"
        exit 1
    fi
}

# Start webhook forwarding
start_webhook_forwarding() {
    print_status "Starting Stripe webhook forwarding..."
    print_status "This will forward webhooks to: http://localhost:3000/api/stripe/webhook"
    print_status ""
    print_warning "Keep this terminal open to receive webhooks"
    print_warning "Press Ctrl+C to stop forwarding"
    print_status ""

    # Start the webhook forwarding with relevant events
    stripe listen \
        --forward-to http://localhost:3000/api/stripe/webhook \
        --events checkout.session.completed \
        --events customer.subscription.created \
        --events customer.subscription.updated \
        --events customer.subscription.deleted \
        --events invoice.paid \
        --events invoice.payment_failed \
        --events payment_intent.succeeded \
        --events payment_intent.payment_failed
}

# Main execution
main() {
    echo "========================================"
    echo "  Stripe Webhook Setup for Talk-To-My-Lawyer"
    echo "========================================"
    echo ""

    print_status "Starting Stripe webhook setup..."
    
    # Run checks
    check_stripe_cli
    check_env_file
    check_dev_server
    
    echo ""
    print_status "All checks passed! Starting webhook forwarding..."
    echo ""
    
    # Login and start forwarding
    stripe_login
    start_webhook_forwarding
}

# Run main function
main "$@"