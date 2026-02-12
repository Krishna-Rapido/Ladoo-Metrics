#!/bin/bash
# Backend Deployment Script
# Run this script on the VM as root or with sudo

set -e

APP_DIR="/opt/ladoo-metrics"
BACKEND_DIR="$APP_DIR/backend"

echo "=== Backend Deployment ==="

# Check if directory exists
if [ ! -d "$BACKEND_DIR" ]; then
    echo "Error: Backend directory not found at $BACKEND_DIR"
    echo "Please clone the repository first:"
    echo "  git clone <repo-url> $APP_DIR"
    exit 1
fi

# Create virtual environment
echo "[1/5] Creating Python virtual environment..."
cd "$BACKEND_DIR"
if [ -d "venv" ]; then
    echo "Virtual environment already exists, removing old one..."
    rm -rf venv
fi
python3 -m venv venv

# Activate venv and upgrade pip
echo "[2/5] Upgrading pip..."
source venv/bin/activate
pip install --upgrade pip setuptools wheel

# Install dependencies
echo "[3/5] Installing Python dependencies..."
pip install -r requirements.txt

# Verify Presto connectivity (optional, can be skipped if network not ready)
echo "[4/5] Testing Presto connectivity..."
if python3 -c "
from pyhive import presto
import os
presto_host = os.environ.get('PRESTO_HOST', 'bi-trino-4.serving.data.production.internal')
try:
    c = presto.connect(presto_host, 80, username='krishna.poddar')
    print('✓ Presto connection successful')
except Exception as e:
    print(f'⚠ Presto connection failed: {e}')
    print('This is OK if the VM cannot reach Presto yet (VPN/routing may be needed)')
" 2>/dev/null; then
    echo "Presto connectivity test completed"
else
    echo "⚠ Presto connectivity test skipped or failed (this is OK for now)"
fi

# Set ownership
echo "[5/5] Setting file permissions..."
chown -R ladoo:ladoo "$BACKEND_DIR"

# Create temp directory for uploads
mkdir -p "$BACKEND_DIR/temp_uploads"
chown -R ladoo:ladoo "$BACKEND_DIR/temp_uploads"
chmod 755 "$BACKEND_DIR/temp_uploads"

echo ""
echo "=== Backend Deployment Complete ==="
echo "Backend is ready at: $BACKEND_DIR"
echo ""
echo "Next steps:"
echo "1. Set PRESTO_HOST environment variable (if different from default)"
echo "2. Test backend: sudo -u ladoo $BACKEND_DIR/venv/bin/python $BACKEND_DIR/main.py"
echo "3. Set up systemd service: cp deployment/ladoo-metrics.service /etc/systemd/system/"
