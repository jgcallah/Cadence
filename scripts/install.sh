#!/usr/bin/env bash
#
# Install Cadence components (CLI, MCP Server, VS Code Extension)
#
# Usage:
#   ./install.sh [options]
#
# Options:
#   --all      Install all components
#   --cli      Install CLI globally (cadence command)
#   --mcp      Install MCP server globally (cadence-mcp command)
#   --vscode   Build and install VS Code extension
#   --build    Force rebuild before installing
#
# Examples:
#   ./install.sh --all              # Install everything
#   ./install.sh --cli              # Just the CLI
#   ./install.sh --cli --mcp        # CLI and MCP server
#   ./install.sh --vscode --build   # Rebuild and install VS Code extension

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

step() {
    echo -e "\n${CYAN}>> $1${NC}"
}

success() {
    echo -e "   ${GREEN}$1${NC}"
}

info() {
    echo -e "   ${GRAY}$1${NC}"
}

error() {
    echo -e "   ${RED}$1${NC}"
    exit 1
}

# Parse arguments
INSTALL_ALL=false
INSTALL_CLI=false
INSTALL_MCP=false
INSTALL_VSCODE=false
FORCE_BUILD=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --all)
            INSTALL_ALL=true
            shift
            ;;
        --cli)
            INSTALL_CLI=true
            shift
            ;;
        --mcp)
            INSTALL_MCP=true
            shift
            ;;
        --vscode)
            INSTALL_VSCODE=true
            shift
            ;;
        --build)
            FORCE_BUILD=true
            shift
            ;;
        -h|--help)
            head -30 "$0" | tail -25
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Show help if no options
if [[ "$INSTALL_ALL" == "false" && "$INSTALL_CLI" == "false" && "$INSTALL_MCP" == "false" && "$INSTALL_VSCODE" == "false" ]]; then
    cat << 'EOF'

Cadence Installer
=================

Usage: ./install.sh [options]

Options:
  --all      Install all components
  --cli      Install CLI globally (cadence command)
  --mcp      Install MCP server globally (cadence-mcp command)
  --vscode   Build and install VS Code extension
  --build    Force rebuild before installing

Examples:
  ./install.sh --all              # Install everything
  ./install.sh --cli              # Just the CLI
  ./install.sh --cli --mcp        # CLI and MCP server
  ./install.sh --vscode --build   # Rebuild and install VS Code extension

EOF
    exit 0
fi

# Resolve what to install
if [[ "$INSTALL_ALL" == "true" ]]; then
    INSTALL_CLI=true
    INSTALL_MCP=true
    INSTALL_VSCODE=true
fi

# Check prerequisites
step "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    error "Node.js is required but not found. Please install Node.js 20+ from https://nodejs.org"
fi

NODE_VERSION=$(node --version | sed 's/v//')
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
if [[ "$NODE_MAJOR" -lt 20 ]]; then
    error "Node.js 20+ is required. Current version: $NODE_VERSION"
fi
success "Node.js $NODE_VERSION"

if ! command -v pnpm &> /dev/null; then
    error "pnpm is required but not found. Install with: npm install -g pnpm"
fi
success "pnpm $(pnpm --version)"

cd "$REPO_ROOT"

# Install dependencies if needed
if [[ ! -d "node_modules" ]]; then
    step "Installing dependencies..."
    pnpm install
    success "Dependencies installed"
fi

# Determine if build is needed
NEEDS_BUILD=false
if [[ "$FORCE_BUILD" == "true" ]]; then
    NEEDS_BUILD=true
elif [[ ! -d "packages/core/dist" ]]; then
    NEEDS_BUILD=true
elif [[ "$INSTALL_CLI" == "true" && ! -d "packages/cli/dist" ]]; then
    NEEDS_BUILD=true
elif [[ "$INSTALL_MCP" == "true" && ! -d "packages/mcp/dist" ]]; then
    NEEDS_BUILD=true
elif [[ "$INSTALL_VSCODE" == "true" && ! -d "packages/vscode/dist" ]]; then
    NEEDS_BUILD=true
fi

if [[ "$NEEDS_BUILD" == "true" ]]; then
    step "Building packages..."
    pnpm build
    success "Build complete"
fi

# Install CLI
if [[ "$INSTALL_CLI" == "true" ]]; then
    step "Installing CLI..."
    cd "$REPO_ROOT/packages/cli"
    npm link
    success "CLI installed globally"
    info "Run 'cadence --help' to get started"
    cd "$REPO_ROOT"
fi

# Install MCP
if [[ "$INSTALL_MCP" == "true" ]]; then
    step "Installing MCP server..."
    cd "$REPO_ROOT/packages/mcp"
    npm link
    success "MCP server installed globally"
    info "Add to Claude Desktop config or run 'cadence-mcp' directly"
    cd "$REPO_ROOT"
fi

# Install VS Code Extension
if [[ "$INSTALL_VSCODE" == "true" ]]; then
    step "Building VS Code extension package..."
    cd "$REPO_ROOT/packages/vscode"

    # Check for vsce
    if ! command -v vsce &> /dev/null; then
        info "Installing vsce..."
        npm install -g @vscode/vsce
    fi

    # Package the extension
    pnpm vscode:package

    # Find the .vsix file
    VSIX=$(ls -t *.vsix 2>/dev/null | head -1)

    if [[ -n "$VSIX" ]]; then
        success "Extension packaged: $VSIX"

        # Check for code CLI
        if command -v code &> /dev/null; then
            info "Installing extension in VS Code..."
            code --install-extension "$VSIX" --force
            success "Extension installed in VS Code"
            info "Reload VS Code to activate"
        else
            info "VS Code CLI not found. Install manually:"
            info "  1. Open VS Code"
            info "  2. Ctrl+Shift+P -> 'Extensions: Install from VSIX...'"
            info "  3. Select: $(pwd)/$VSIX"
        fi
    else
        error "Failed to create .vsix package"
    fi

    cd "$REPO_ROOT"
fi

echo ""
echo -e "${GREEN}Installation complete!${NC}"
echo ""

# Print summary
if [[ "$INSTALL_CLI" == "true" ]]; then
    echo "  CLI:     cadence --help"
fi
if [[ "$INSTALL_MCP" == "true" ]]; then
    echo "  MCP:     cadence-mcp (or configure in Claude Desktop)"
fi
if [[ "$INSTALL_VSCODE" == "true" ]]; then
    echo "  VS Code: Reload window to activate extension"
fi
echo ""
