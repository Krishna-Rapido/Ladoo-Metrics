#!/bin/bash
# Frontend Deployment Script
# Run this script from the repository root on the VM as root or with sudo:
#   bash deployment/deploy-frontend.sh

set -e

APP_DIR="/opt/ladoo-metrics"
FRONTEND_DIR="$APP_DIR/frontend"

# Determine repository root (parent of the deployment/ directory this script lives in)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_FRONTEND="$REPO_DIR/frontend"

echo "=== Frontend Deployment ==="

# ── Step 0: Sync source code from repo to deployment directory ──────────
echo "[0/5] Syncing frontend source code..."
if [ ! -d "$REPO_FRONTEND/src" ]; then
    echo "Error: Repository frontend not found at $REPO_FRONTEND"
    echo "Please run this script from the repository root: bash deployment/deploy-frontend.sh"
    exit 1
fi

mkdir -p "$FRONTEND_DIR"

if command -v rsync &>/dev/null; then
    rsync -a --delete \
        --exclude 'node_modules' \
        --exclude 'dist' \
        --exclude '.env.production' \
        "$REPO_FRONTEND/" "$FRONTEND_DIR/"
else
    # Fallback if rsync is not installed
    echo "rsync not found, using cp..."
    # Remove old source files (keep node_modules & dist)
    find "$FRONTEND_DIR" -maxdepth 1 -mindepth 1 \
        ! -name 'node_modules' ! -name 'dist' ! -name '.env.production' \
        -exec rm -rf {} +
    # Copy fresh source
    cd "$REPO_FRONTEND"
    for item in $(ls -A | grep -v -E '^(node_modules|dist|\.env\.production)$'); do
        cp -a "$item" "$FRONTEND_DIR/"
    done
fi
echo "Synced frontend source to $FRONTEND_DIR"

cd "$FRONTEND_DIR"

# ── Step 1: Ensure Node.js and npm are installed ───────────────────────
echo "[1/5] Checking for Node.js and npm..."
if ! command -v npm >/dev/null 2>&1 || ! command -v node >/dev/null 2>&1; then
    echo "Node.js and/or npm not found. Attempting to install..."
    apt-get update -qq
    apt-get install -y curl ca-certificates
    if ! command -v curl >/dev/null 2>&1; then
        echo "curl not found and installation failed."
        exit 1
    fi
    # Install NodeSource Node.js 20.x if not present
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    if ! command -v npm >/dev/null 2>&1 || ! command -v node >/dev/null 2>&1; then
        echo "ERROR: Failed to install Node.js and npm."
        exit 1
    fi
    echo "Installed $(node --version) and $(npm --version)"
else
    echo "Found Node.js $(node --version) and npm $(npm --version)"
fi

# ── Step 2: Create production environment file ─────────────────────────
echo "[2/5] Creating production environment file..."
cat > .env.production << 'EOF'
# Production environment - API calls use same origin (Nginx will proxy)
VITE_API_BASE_URL=
EOF
echo "Created .env.production with empty VITE_API_BASE_URL"

# ── Step 3: Install dependencies ───────────────────────────────────────
echo "[3/5] Installing Node.js dependencies..."
npm install

# Fix execute permissions on binaries (can be lost after chown by other scripts)
chmod +x node_modules/.bin/* 2>/dev/null || true

# ── Step 4: Build frontend ─────────────────────────────────────────────
echo "[4/5] Building frontend for production..."
npm run build

# Verify build
if [ ! -d "dist" ]; then
    echo "Error: Build failed - dist directory not found"
    exit 1
fi

echo "Frontend built successfully:"
ls -lh dist/

# ── Step 5: Set ownership ─────────────────────────────────────────────
echo "[5/5] Setting file permissions..."
# Try ladoo user first (created by security-hardening.sh), fall back to current user
if id "ladoo" &>/dev/null; then
    chown -R ladoo:ladoo "$FRONTEND_DIR"
else
    echo "Note: 'ladoo' user not found, skipping chown (run security-hardening.sh first)"
fi

echo ""
echo "=== Frontend Deployment Complete ==="
echo "Frontend build is ready at: $FRONTEND_DIR/dist"
echo ""
echo "Next steps:"
echo "1. Verify Nginx config points to $FRONTEND_DIR/dist"
echo "2. Reload Nginx: systemctl reload nginx"
echo "3. Test: curl http://localhost/ (after Nginx is configured)"
