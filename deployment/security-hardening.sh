#!/bin/bash
# Security Hardening Script
# Run this script on the VM as root or with sudo

set -e

echo "=== Security Hardening ==="

APP_DIR="/opt/ladoo-metrics"
LOG_DIR="/var/log/ladoo-metrics"

# Ensure dedicated user exists
if ! id "ladoo" &>/dev/null; then
    echo "Creating dedicated user 'ladoo'..."
    useradd -r -s /bin/bash -d "$APP_DIR" -m ladoo
else
    echo "User 'ladoo' already exists"
fi

# Set proper file permissions
echo "[1/5] Setting file permissions..."

# Application files - owned by ladoo, read-only
chown -R ladoo:ladoo "$APP_DIR"
find "$APP_DIR" -type f -exec chmod 644 {} \;
find "$APP_DIR" -type d -exec chmod 755 {} \;

# Make scripts executable
chmod +x "$APP_DIR"/deployment/*.sh

# Backend - allow execution
chmod +x "$APP_DIR/backend/main.py"
chmod +x "$APP_DIR/backend/venv/bin/python"

# Temp uploads directory - writable by ladoo
mkdir -p "$APP_DIR/backend/temp_uploads"
chown -R ladoo:ladoo "$APP_DIR/backend/temp_uploads"
chmod 755 "$APP_DIR/backend/temp_uploads"

# Log directory
mkdir -p "$LOG_DIR"
chown -R ladoo:ladoo "$LOG_DIR"
chmod 755 "$LOG_DIR"

# Configure UFW firewall
echo "[2/5] Configuring UFW firewall..."
# Allow SSH (critical - don't lock yourself out!)
ufw allow 22/tcp comment 'SSH'
# Allow HTTP (for Cloudflare tunnel)
ufw allow 80/tcp comment 'HTTP for Cloudflare Tunnel'
# Deny all other incoming by default
ufw default deny incoming
ufw default allow outgoing
# Enable firewall (non-interactive)
ufw --force enable

echo "UFW status:"
ufw status verbose

# Configure log rotation
echo "[3/5] Configuring log rotation..."

cat > /etc/logrotate.d/ladoo-metrics << 'EOF'
/var/log/ladoo-metrics/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 ladoo ladoo
    sharedscripts
    postrotate
        systemctl reload ladoo-metrics > /dev/null 2>&1 || true
    endscript
}

/var/log/nginx/ladoo-metrics-*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        systemctl reload nginx > /dev/null 2>&1 || true
    endscript
}
EOF

echo "Log rotation configured"

# Systemd service security (already in service file, but verify)
echo "[4/4] Verifying systemd service security..."
if [ -f /etc/systemd/system/ladoo-metrics.service ]; then
    echo "✓ systemd service file exists"
    # Check if it has security settings
    if grep -q "NoNewPrivileges=true" /etc/systemd/system/ladoo-metrics.service; then
        echo "✓ Security hardening in systemd service verified"
    else
        echo "⚠ Warning: systemd service may not have all security settings"
    fi
else
    echo "⚠ Warning: systemd service file not found. Install it first."
fi

# Disable root login via SSH (optional, commented out for safety)
# Uncomment if you want to disable root SSH login:
# sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
# systemctl restart sshd

echo ""
echo "=== Security Hardening Complete ==="
echo ""
echo "Summary:"
echo "  ✓ Dedicated user 'ladoo' created"
echo "  ✓ File permissions set"
echo "  ✓ UFW firewall configured (ports 22, 80 open)"
echo "  ✓ Log rotation configured (30 days retention)"
echo ""
echo "Next steps:"
echo "  1. Test firewall: ufw status"
echo "  2. Verify service runs as 'ladoo' user: systemctl status ladoo-metrics"
