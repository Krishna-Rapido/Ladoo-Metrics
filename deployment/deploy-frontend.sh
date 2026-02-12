#!/bin/bash
# Frontend Deployment Script
# Run this script on the VM as root or with sudo

set -e

APP_DIR="/opt/ladoo-metrics"
FRONTEND_DIR="$APP_DIR/frontend"

echo "=== Frontend Deployment ==="

# Check if directory exists
if [ ! -d "$FRONTEND_DIR" ]; then
    echo "Error: Frontend directory not found at $FRONTEND_DIR"
    echo "Please clone the repository first"
    exit 1
fi

cd "$FRONTEND_DIR"

# Ensure Node.js and npm are installed
echo "[0/4] Checking for Node.js and npm..."
if ! command -v npm >/dev/null 2>&1 || ! command -v node >/dev/null 2>&1; then
    echo "Node.js and/or npm not found. Attempting to install..."
    # Try the apt repositories first
    apt-get update -qq
    apt-get install -y curl ca-certificates
    if ! command -v curl >/dev/null 2>&1; then
        echo "curl not found and installation failed."
        exit 1
    fi
    # Install NodeSource Node.js 20.x if not present
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    # Verify installation
    if ! command -v npm >/dev/null 2>&1 || ! command -v node >/dev/null 2>&1; then
        echo "ERROR: Failed to install Node.js and npm."
        exit 1
    fi
    echo "Installed $(node --version) and $(npm --version)"
else
    echo "Found Node.js $(node --version) and npm $(npm --version)"
fi

# Create production environment file
echo "[1/4] Creating production environment file..."
cat > .env.production << 'EOF'
# Production environment - API calls use same origin (Nginx will proxy)
VITE_API_BASE_URL=
EOF
echo "Created .env.production with empty VITE_API_BASE_URL"

# Install dependencies
echo "[2/4] Installing Node.js dependencies..."
npm install

# Build frontend
echo "[3/4] Building frontend for production..."
npm run build

# Verify build
if [ ! -d "dist" ]; then
    echo "Error: Build failed - dist directory not found"
    exit 1
fi

# Set ownership
echo "[4/4] Setting file permissions..."
chown -R ladoo:ladoo "$FRONTEND_DIR"

echo ""
echo "=== Frontend Deployment Complete ==="
echo "Frontend build is ready at: $FRONTEND_DIR/dist"
echo ""
echo "Next steps:"
echo "1. Configure Nginx to serve from $FRONTEND_DIR/dist"
echo "2. Test: curl http://localhost/ (after Nginx is configured)"
