#!/bin/bash
# Script to remove Cloudflare Tunnel from the VM
# Run this script as root or with sudo

set -e

echo "=== Removing Cloudflare Tunnel ==="

# Stop and disable the cloudflare-tunnel service
if systemctl is-active --quiet cloudflare-tunnel 2>/dev/null; then
    echo "[1/4] Stopping cloudflare-tunnel service..."
    systemctl stop cloudflare-tunnel
    echo "✓ Service stopped"
else
    echo "[1/4] cloudflare-tunnel service is not running"
fi

if systemctl is-enabled --quiet cloudflare-tunnel 2>/dev/null; then
    echo "[2/4] Disabling cloudflare-tunnel service..."
    systemctl disable cloudflare-tunnel
    echo "✓ Service disabled"
else
    echo "[2/4] cloudflare-tunnel service is not enabled"
fi

# Remove systemd service file
if [ -f /etc/systemd/system/cloudflare-tunnel.service ]; then
    echo "[3/4] Removing systemd service file..."
    rm -f /etc/systemd/system/cloudflare-tunnel.service
    systemctl daemon-reload
    echo "✓ Service file removed"
else
    echo "[3/4] Systemd service file not found"
fi

# Uninstall cloudflared
if command -v cloudflared &> /dev/null; then
    echo "[4/4] Uninstalling cloudflared..."
    # Try to remove via apt if installed via package manager
    if dpkg -l | grep -q cloudflared; then
        apt-get remove -y cloudflared 2>/dev/null || true
        apt-get purge -y cloudflared 2>/dev/null || true
    fi
    # Remove binary if installed manually
    rm -f /usr/local/bin/cloudflared
    rm -f /usr/bin/cloudflared
    echo "✓ cloudflared uninstalled"
else
    echo "[4/4] cloudflared not found"
fi

# Remove cloudflared configuration files
echo "Removing cloudflared configuration files..."
rm -rf /etc/cloudflared
rm -rf /root/.cloudflared
rm -rf ~/.cloudflared
echo "✓ Configuration files removed"

# Kill any running cloudflared processes
if pgrep -x cloudflared > /dev/null; then
    echo "Killing any remaining cloudflared processes..."
    pkill -9 cloudflared 2>/dev/null || true
    sleep 2
    echo "✓ Processes terminated"
fi

echo ""
echo "=== Cloudflare Tunnel Removal Complete ==="
echo ""
echo "Summary:"
echo "  ✓ cloudflare-tunnel service stopped and disabled"
echo "  ✓ Systemd service file removed"
echo "  ✓ cloudflared uninstalled"
echo "  ✓ Configuration files removed"
echo "  ✓ Running processes terminated"
echo ""
echo "Note: The application is still accessible via HTTP on port 80"
echo "      Access it at: http://laddoo.labs.plectrum.dev/"
