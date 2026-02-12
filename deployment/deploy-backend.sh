#!/bin/bash
# Backend Deployment Script
# Run this script on the VM as root or with sudo

set -e

APP_DIR="/opt/ladoo-metrics"
BACKEND_DIR="$APP_DIR/backend"
REQUIRED_PYTHON_MINOR=10  # Minimum Python 3.10 required

echo "=== Backend Deployment ==="

# Check if directory exists
if [ ! -d "$BACKEND_DIR" ]; then
    echo "Error: Backend directory not found at $BACKEND_DIR"
    echo "Please clone the repository first:"
    echo "  git clone <repo-url> $APP_DIR"
    exit 1
fi

# --- Ensure a compatible Python version (>= 3.10) is available ---
echo "[0/5] Checking for Python >= 3.$REQUIRED_PYTHON_MINOR ..."
PYTHON_BIN=""

# Check for existing Python 3.10+ installations (prefer highest version)
for v in 13 12 11 10; do
    if command -v "python3.$v" &>/dev/null; then
        PYTHON_BIN="python3.$v"
        break
    fi
done

# Fall back to system python3 if it's new enough
if [ -z "$PYTHON_BIN" ] && command -v python3 &>/dev/null; then
    SYS_MINOR=$(python3 -c "import sys; print(sys.version_info.minor)" 2>/dev/null || echo 0)
    if [ "$SYS_MINOR" -ge "$REQUIRED_PYTHON_MINOR" ]; then
        PYTHON_BIN="python3"
    fi
fi

# If no suitable Python found, install one
if [ -z "$PYTHON_BIN" ]; then
    echo "No Python >= 3.$REQUIRED_PYTHON_MINOR found. Attempting to install..."

    # --- Attempt 1: deadsnakes PPA ---
    INSTALLED_VIA_PPA=false
    echo "Trying deadsnakes PPA..."
    apt-get update -qq
    apt-get install -y software-properties-common
    add-apt-repository -y ppa:deadsnakes/ppa
    apt-get update

    for v in 12 11 10; do
        if apt-cache show "python3.$v" &>/dev/null; then
            echo "Found python3.$v in deadsnakes PPA, installing..."
            apt-get install -y "python3.$v" "python3.$v-venv" "python3.$v-dev" && {
                PYTHON_BIN="python3.$v"
                INSTALLED_VIA_PPA=true
                break
            }
        fi
    done

    # --- Attempt 2: Build from source ---
    if [ "$INSTALLED_VIA_PPA" = false ]; then
        PYTHON_VER="3.10.16"
        echo "deadsnakes PPA did not have a suitable package."
        echo "Building Python $PYTHON_VER from source (this may take a few minutes)..."
        apt-get install -y build-essential zlib1g-dev libncurses5-dev \
            libgdbm-dev libnss3-dev libssl-dev libreadline-dev libffi-dev \
            libsqlite3-dev libbz2-dev liblzma-dev
        cd /tmp
        curl -fSL "https://www.python.org/ftp/python/${PYTHON_VER}/Python-${PYTHON_VER}.tgz" -o python.tgz
        tar xzf python.tgz
        cd "Python-${PYTHON_VER}"
        ./configure --enable-optimizations --prefix=/usr/local 2>&1 | tail -1
        make -j"$(nproc)" 2>&1 | tail -1
        make altinstall
        cd /tmp && rm -rf "Python-${PYTHON_VER}" python.tgz
        PYTHON_BIN="python3.10"
    fi
fi

if [ -z "$PYTHON_BIN" ] || ! command -v "$PYTHON_BIN" &>/dev/null; then
    echo "ERROR: Failed to install a suitable Python version."
    exit 1
fi

echo "Using $($PYTHON_BIN --version 2>&1) ($PYTHON_BIN)"

# Create virtual environment
echo "[1/5] Creating Python virtual environment..."
cd "$BACKEND_DIR"
if [ -d "venv" ]; then
    echo "Virtual environment already exists, removing old one..."
    rm -rf venv
fi
$PYTHON_BIN -m venv venv

# Activate venv and upgrade pip
echo "[2/5] Upgrading pip..."
source venv/bin/activate
pip install --upgrade pip setuptools wheel

# Install dependencies
echo "[3/5] Installing Python dependencies..."
pip install -r requirements.txt

# Verify Presto connectivity (optional, can be skipped if network not ready)
echo "[4/5] Testing Presto connectivity..."
if python -c "
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
