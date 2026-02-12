#!/bin/bash
# VM System Setup Script for Ladoo Metrics
# Run this script on the Ubuntu VM as root or with sudo

set -e

echo "=== Ladoo Metrics VM Setup ==="
echo "This script will install all required system packages"
echo ""

# Update package list
echo "[1/8] Updating package list..."
apt-get update

# Install basic utilities
echo "[2/8] Installing basic utilities (git, curl, wget)..."
apt-get install -y git curl wget software-properties-common

# Install Python 3.10+ (Ubuntu 20.04 ships with 3.8)
echo "[3/8] Installing Python 3.10..."
add-apt-repository -y ppa:deadsnakes/ppa
apt-get update
apt-get install -y python3.10 python3.10-venv python3.10-dev python3-pip
# Create symlink for python3 -> python3.10
update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.10 1

# Install Node.js 18 LTS
echo "[4/8] Installing Node.js 18 LTS..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install Nginx
echo "[5/8] Installing Nginx..."
apt-get install -y nginx

# Install apache2-utils for htpasswd
echo "[6/8] Installing apache2-utils (for htpasswd)..."
apt-get install -y apache2-utils

# Install Cloudflared
echo "[7/8] Installing Cloudflared..."
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
dpkg -i cloudflared-linux-amd64.deb || apt-get install -f -y
rm -f cloudflared-linux-amd64.deb

# Install UFW firewall
echo "[8/8] Installing and configuring UFW firewall..."
apt-get install -y ufw
# Allow SSH
ufw allow 22/tcp
# Allow HTTP (for Cloudflare tunnel)
ufw allow 80/tcp
# Enable firewall (non-interactive)
ufw --force enable

# Create dedicated system user for the application
echo "Creating dedicated system user 'ladoo'..."
if ! id "ladoo" &>/dev/null; then
    useradd -r -s /bin/bash -d /opt/ladoo-metrics -m ladoo
    echo "User 'ladoo' created"
else
    echo "User 'ladoo' already exists"
fi

# Create necessary directories
echo "Creating application directories..."
mkdir -p /opt/ladoo-metrics
mkdir -p /var/log/ladoo-metrics
chown -R ladoo:ladoo /opt/ladoo-metrics
chown -R ladoo:ladoo /var/log/ladoo-metrics

echo ""
echo "=== Setup Complete ==="
echo "Installed versions:"
python3 --version
node --version
nginx -v
cloudflared --version
echo ""
echo "Next steps:"
echo "1. Clone the repository to /opt/ladoo-metrics/"
echo "2. Run deployment/deploy-backend.sh"
echo "3. Run deployment/deploy-frontend.sh"
echo "4. Configure Nginx (deployment/nginx-ladoo-metrics.conf)"
echo "5. Set up systemd service (deployment/ladoo-metrics.service)"
echo "6. Configure Cloudflare Tunnel"
