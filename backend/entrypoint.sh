#!/bin/bash
set -e

# =============================================================================
# OpenVPN Entrypoint Script for Render.com
# Starts VPN tunnel before launching the application
# =============================================================================

# Validate OPENVPN_CONFIG environment variable
if [ -z "$OPENVPN_CONFIG" ]; then
    echo "ERROR: OPENVPN_CONFIG environment variable not set"
    echo "Set this variable in Render dashboard with your .ovpn file contents"
    exit 1
fi

# Write OpenVPN config to temporary file
echo "$OPENVPN_CONFIG" > /tmp/client.ovpn
chmod 600 /tmp/client.ovpn

# Create TUN device if it doesn't exist
# NOTE: This may fail on Render without privileged access
mkdir -p /dev/net
if [ ! -c /dev/net/tun ]; then
    echo "Creating TUN device..."
    mknod /dev/net/tun c 10 200 2>/dev/null || echo "WARN: Could not create TUN device (may already exist or lack permissions)"
    chmod 600 /dev/net/tun 2>/dev/null || true
fi

# Start OpenVPN in daemon mode with logging
echo "Starting OpenVPN client..."
openvpn --config /tmp/client.ovpn --daemon --log /tmp/openvpn.log --writepid /tmp/openvpn.pid

# Wait for tunnel to establish
echo "Waiting for VPN connection to establish..."
sleep 8

# Check if OpenVPN is running
if [ -f /tmp/openvpn.pid ] && kill -0 $(cat /tmp/openvpn.pid) 2>/dev/null; then
    echo "OpenVPN process is running (PID: $(cat /tmp/openvpn.pid))"
else
    echo "ERROR: OpenVPN failed to start. Check logs:"
    cat /tmp/openvpn.log 2>/dev/null || echo "No log file found"
    exit 1
fi

# Log external IP for verification
echo "Verifying VPN connection..."
EXTERNAL_IP=$(curl -s --max-time 10 ifconfig.me || echo "Failed to retrieve")
echo "External IP: $EXTERNAL_IP"

# Clean up sensitive config file
rm -f /tmp/client.ovpn

# Start the application
echo "Starting application..."
exec python main.py
