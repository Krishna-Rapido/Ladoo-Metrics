#!/bin/bash
# Fix firewall rules to ensure port 80 is accessible
# Run as root/sudo

set -e

echo "=== Fixing Firewall Rules for Port 80 ==="

# Ensure UFW allows port 80
if command -v ufw &> /dev/null; then
    echo "[1/3] Configuring UFW..."
    ufw allow 80/tcp comment 'HTTP for laddoo.labs.plectrum.dev' || true
    ufw --force enable || true
    echo "✓ UFW configured"
fi

# Ensure iptables allows port 80 (in case UFW doesn't handle it)
echo "[2/3] Configuring iptables..."
# Check if rule already exists
if ! iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null; then
    iptables -I INPUT -p tcp --dport 80 -j ACCEPT
    echo "✓ iptables rule added"
else
    echo "✓ iptables rule already exists"
fi

# Save iptables rules if possible
if [ -d "/etc/iptables" ]; then
    mkdir -p /etc/iptables
    iptables-save > /etc/iptables/rules.v4 2>/dev/null && echo "✓ iptables rules saved" || echo "⚠ Could not save iptables rules"
elif [ -f "/etc/iptables.rules" ] || [ -w "/etc" ]; then
    iptables-save > /etc/iptables.rules 2>/dev/null && echo "✓ iptables rules saved" || echo "⚠ Could not save iptables rules"
fi

# Verify port 80 is accessible
echo "[3/3] Verifying configuration..."
if ss -tlnp | grep -q ":80 "; then
    echo "✓ Port 80 is listening"
else
    echo "✗ Port 80 is NOT listening - check Nginx"
    exit 1
fi

echo ""
echo "=== Firewall Configuration Complete ==="
echo "Port 80 should now be accessible from the network"
echo "Test with: curl http://laddoo.labs.plectrum.dev/health"
