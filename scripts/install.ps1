<#
.SYNOPSIS
    Install Cadence components (CLI, MCP Server, VS Code Extension)

.DESCRIPTION
    This script builds and installs Cadence components from source.
    You can install all components or select specific ones.

.PARAMETER All
    Install all components (CLI, MCP, VS Code Extension)

.PARAMETER Cli
    Install the CLI globally via npm link

.PARAMETER Mcp
    Install the MCP server globally via npm link

.PARAMETER Vscode
    Build and install the VS Code extension

.PARAMETER Build
    Force rebuild before installing (default: only builds if dist/ missing)

.EXAMPLE
    .\install.ps1 -All
    Install all components

.EXAMPLE
    .\install.ps1 -Cli -Mcp
    Install only CLI and MCP server

.EXAMPLE
    .\install.ps1 -Vscode -Build
    Rebuild and install VS Code extension
#>

param(
    [switch]$All,
    [switch]$Cli,
    [switch]$Mcp,
    [switch]$Vscode,
    [switch]$Build
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot

function Write-Step {
    param([string]$Message)
    Write-Host "`n>> $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "   $Message" -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host "   $Message" -ForegroundColor Gray
}

function Test-Command {
    param([string]$Command)
    $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
}

# Check prerequisites
Write-Step "Checking prerequisites..."

if (-not (Test-Command "node")) {
    throw "Node.js is required but not found. Please install Node.js 20+ from https://nodejs.org"
}

$nodeVersion = (node --version) -replace 'v', ''
$nodeMajor = [int]($nodeVersion.Split('.')[0])
if ($nodeMajor -lt 20) {
    throw "Node.js 20+ is required. Current version: $nodeVersion"
}
Write-Success "Node.js $nodeVersion"

if (-not (Test-Command "pnpm")) {
    throw "pnpm is required but not found. Install with: npm install -g pnpm"
}
Write-Success "pnpm $(pnpm --version)"

# If no specific component selected, show help
if (-not ($All -or $Cli -or $Mcp -or $Vscode)) {
    Write-Host @"

Cadence Installer
=================

Usage: .\install.ps1 [options]

Options:
  -All      Install all components
  -Cli      Install CLI globally (cadence command)
  -Mcp      Install MCP server globally (cadence-mcp command)
  -Vscode   Build and install VS Code extension
  -Build    Force rebuild before installing

Examples:
  .\install.ps1 -All              # Install everything
  .\install.ps1 -Cli              # Just the CLI
  .\install.ps1 -Cli -Mcp         # CLI and MCP server
  .\install.ps1 -Vscode -Build    # Rebuild and install VS Code extension

"@
    exit 0
}

# Resolve what to install
$installCli = $All -or $Cli
$installMcp = $All -or $Mcp
$installVscode = $All -or $Vscode

Push-Location $RepoRoot
try {
    # Install dependencies if needed
    if (-not (Test-Path "node_modules")) {
        Write-Step "Installing dependencies..."
        pnpm install
        Write-Success "Dependencies installed"
    }

    # Build if needed or forced
    $needsBuild = $Build -or
                  (-not (Test-Path "packages/core/dist")) -or
                  ($installCli -and -not (Test-Path "packages/cli/dist")) -or
                  ($installMcp -and -not (Test-Path "packages/mcp/dist")) -or
                  ($installVscode -and -not (Test-Path "packages/vscode/dist"))

    if ($needsBuild) {
        Write-Step "Building packages..."
        pnpm build
        Write-Success "Build complete"
    }

    # Install CLI
    if ($installCli) {
        Write-Step "Installing CLI..."
        Push-Location "packages/cli"
        try {
            npm link
            Write-Success "CLI installed globally"
            Write-Info "Run 'cadence --help' to get started"
        }
        finally {
            Pop-Location
        }
    }

    # Install MCP
    if ($installMcp) {
        Write-Step "Installing MCP server..."
        Push-Location "packages/mcp"
        try {
            npm link
            Write-Success "MCP server installed globally"
            Write-Info "Add to Claude Desktop config or run 'cadence-mcp' directly"
        }
        finally {
            Pop-Location
        }
    }

    # Install VS Code Extension
    if ($installVscode) {
        Write-Step "Building VS Code extension package..."
        Push-Location "packages/vscode"
        try {
            # Package the extension using npx to avoid pnpm hoisting issues
            Write-Info "Packaging extension with vsce..."
            npx @vscode/vsce package --no-dependencies

            # Find the .vsix file
            $vsix = Get-ChildItem -Filter "*.vsix" | Sort-Object LastWriteTime -Descending | Select-Object -First 1

            if ($vsix) {
                Write-Success "Extension packaged: $($vsix.Name)"

                # Check for code CLI
                if (Test-Command "code") {
                    Write-Info "Installing extension in VS Code..."
                    code --install-extension $vsix.FullName --force
                    Write-Success "Extension installed in VS Code"
                    Write-Info "Reload VS Code to activate"
                }
                else {
                    Write-Info "VS Code CLI not found. Install manually:"
                    Write-Info "  1. Open VS Code"
                    Write-Info "  2. Ctrl+Shift+P -> 'Extensions: Install from VSIX...'"
                    Write-Info "  3. Select: $($vsix.FullName)"
                }
            }
            else {
                throw "Failed to create .vsix package"
            }
        }
        finally {
            Pop-Location
        }
    }

    Write-Host "`n" -NoNewline
    Write-Host "Installation complete!" -ForegroundColor Green
    Write-Host ""

    # Print summary
    if ($installCli) {
        Write-Host "  CLI:     cadence --help" -ForegroundColor White
    }
    if ($installMcp) {
        Write-Host "  MCP:     cadence-mcp (or configure in Claude Desktop)" -ForegroundColor White
    }
    if ($installVscode) {
        Write-Host "  VS Code: Reload window to activate extension" -ForegroundColor White
    }
    Write-Host ""
}
finally {
    Pop-Location
}
