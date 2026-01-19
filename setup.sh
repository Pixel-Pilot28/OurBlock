#!/bin/bash
# OurBlock Quick Setup Script
# This script helps you get started with OurBlock development

set -e  # Exit on error

echo "🏘️  OurBlock Setup Script"
echo "======================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${BLUE}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Check for required tools
print_step "Checking prerequisites..."

# Check for Nix
if ! command -v nix &> /dev/null; then
    echo "❌ Nix not found!"
    echo "Please install Nix first:"
    echo "  curl -L https://nixos.org/nix/install | sh"
    exit 1
fi
print_success "Nix is installed"

# Check if we're in a Nix shell
if [ -z "$IN_NIX_SHELL" ]; then
    print_warning "Not in Nix shell. Entering development shell..."
    echo ""
    echo "Run this command instead:"
    echo "  nix develop --command bash $0"
    exit 0
fi

# Check for Holochain tools
print_step "Verifying Holochain tools..."
if ! command -v hc &> /dev/null; then
    echo "❌ Holochain CLI (hc) not found!"
    echo "Make sure you're in the Nix development shell:"
    echo "  nix develop"
    exit 1
fi
print_success "Holochain CLI ready ($(hc --version))"

if ! command -v holochain &> /dev/null; then
    echo "❌ Holochain conductor not found!"
    exit 1
fi
print_success "Holochain conductor ready ($(holochain --version))"

# Ask user what they want to do
echo ""
echo "What would you like to do?"
echo "  1) Full setup (build + run Hub + run UI)"
echo "  2) Build zomes only"
echo "  3) Run Hub only"
echo "  4) Run UI only"
echo "  5) Test join flow"
echo ""
read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        print_step "Starting full setup..."
        
        # Build zomes
        print_step "Building WASM zomes..."
        cargo build --release --target wasm32-unknown-unknown
        print_success "Zomes compiled"
        
        # Package DNA
        print_step "Packaging DNA..."
        hc dna pack dnas/our_block/workdir -o dnas/our_block/workdir/our_block.dna
        print_success "DNA packaged"
        
        # Package hApp
        print_step "Packaging hApp..."
        hc app pack workdir -o workdir/our_block.happ
        print_success "hApp packaged"
        
        # Check if UI dependencies are installed
        if [ ! -d "ui/node_modules" ]; then
            print_step "Installing UI dependencies..."
            cd ui
            npm install
            cd ..
            print_success "UI dependencies installed"
        fi
        
        print_success "Build complete!"
        echo ""
        echo "Next steps:"
        echo "  Terminal 1 (Hub): Run the Hub"
        echo "    hc sandbox generate workdir/our_block.happ --run=8888 -a our_block"
        echo ""
        echo "  Terminal 2 (UI): Run the frontend"
        echo "    cd ui && npm run dev"
        echo ""
        echo "Then open http://localhost:5173 in your browser"
        ;;
        
    2)
        print_step "Building zomes..."
        cargo build --release --target wasm32-unknown-unknown
        print_success "Zomes compiled"
        
        print_step "Packaging DNA..."
        hc dna pack dnas/our_block/workdir -o dnas/our_block/workdir/our_block.dna
        print_success "DNA packaged"
        
        print_step "Packaging hApp..."
        hc app pack workdir -o workdir/our_block.happ
        print_success "hApp packaged"
        ;;
        
    3)
        print_step "Starting Holochain sandbox..."
        
        # Check if hApp exists
        if [ ! -f "workdir/our_block.happ" ]; then
            print_warning "hApp not found. Building first..."
            cargo build --release --target wasm32-unknown-unknown
            hc dna pack dnas/our_block/workdir -o dnas/our_block/workdir/our_block.dna
            hc app pack workdir -o workdir/our_block.happ
        fi
        
        echo ""
        echo "Starting Hub on port 8888..."
        echo "Press Ctrl+C to stop"
        echo ""
        hc sandbox generate workdir/our_block.happ --run=8888 -a our_block
        ;;
        
    4)
        print_step "Starting UI development server..."
        
        if [ ! -d "ui/node_modules" ]; then
            print_step "Installing dependencies first..."
            cd ui
            npm install
            cd ..
        fi
        
        cd ui
        npm run dev
        ;;
        
    5)
        print_step "Setting up join flow test..."
        
        # Build if needed
        if [ ! -f "workdir/our_block.happ" ]; then
            print_warning "hApp not found. Building first..."
            cargo build --release --target wasm32-unknown-unknown
            hc dna pack dnas/our_block/workdir -o dnas/our_block/workdir/our_block.dna
            hc app pack workdir -o workdir/our_block.happ
        fi
        
        echo ""
        echo "Join Flow Test Setup"
        echo "===================="
        echo ""
        echo "Step 1: Start the Hub (in Terminal 1)"
        echo "  hc sandbox generate workdir/our_block.happ --run=8888 -a our_block"
        echo ""
        echo "Step 2: Generate an invite code"
        echo "  hc sandbox call-admin --port 4444 generate_invitation '{"neighbor_name": "TestUser"}'"
        echo ""
        echo "Step 3: Start the UI (in Terminal 2)"
        echo "  cd ui && npm run dev"
        echo ""
        echo "Step 4: Test the join flow"
        echo "  1. Open http://localhost:5173/join"
        echo "  2. Paste the invite code from Step 2"
        echo "  3. Click 'Join Neighborhood'"
        echo "  4. Watch for success or errors"
        echo ""
        echo "See docs/TESTING_JOIN_FLOW.md for detailed testing guide"
        ;;
        
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac

echo ""
print_success "Done! 🎉"
