# Deployment Files

This directory contains all scripts and configuration files needed to deploy Ladoo Metrics on the internal VM.

## Files Overview

### Setup Scripts
- **vm-setup.sh** - Initial system setup (Python, Node, Nginx, Cloudflared, UFW)
- **deploy-backend.sh** - Backend deployment (venv, dependencies, Presto test)
- **deploy-frontend.sh** - Frontend build for production
- **security-hardening.sh** - Security configuration (permissions, firewall, log rotation)
- **verify-deployment.sh** - Verification script to test all components

### Configuration Files
- **nginx-ladoo-metrics.conf** - Nginx reverse proxy configuration
- **ladoo-metrics.service** - systemd service file for the backend
- **cloudflare-tunnel.service** - systemd service file for Cloudflare Tunnel

### Documentation
- **DEPLOYMENT_INSTRUCTIONS.md** - Step-by-step deployment guide
- **README.md** - This file

## Quick Start

1. **System Setup**
   ```bash
   sudo bash deployment/vm-setup.sh
   ```

2. **Clone Repository**
   ```bash
   cd /opt
   git clone <repo-url> ladoo-metrics
   ```

3. **Deploy Backend**
   ```bash
   cd /opt/ladoo-metrics
   sudo bash deployment/deploy-backend.sh
   ```

4. **Deploy Frontend**
   ```bash
   sudo bash deployment/deploy-frontend.sh
   ```

5. **Configure Nginx**
   ```bash
   # Install config
   sudo cp deployment/nginx-ladoo-metrics.conf /etc/nginx/sites-available/ladoo-metrics
   sudo ln -s /etc/nginx/sites-available/ladoo-metrics /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

6. **Set Up systemd Service**
   ```bash
   sudo cp deployment/ladoo-metrics.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable ladoo-metrics
   sudo systemctl start ladoo-metrics
   ```

7. **Security Hardening**
   ```bash
   sudo bash deployment/security-hardening.sh
   ```

8. **Verify Deployment**
   ```bash
   sudo bash deployment/verify-deployment.sh
   ```

9. **Configure Cloudflare Tunnel**
   See `DEPLOYMENT_INSTRUCTIONS.md` for detailed Cloudflare Tunnel setup.

## Environment Variables

The backend uses these environment variables (set in systemd service):

- **PORT** - Backend port (default: 8001)
- **PRESTO_HOST** - Presto hostname (default: bi-trino-4.serving.data.production.internal)
- **PRESTO_PORT** - Presto port (default: 80)
- **ALLOWED_ORIGINS** - Comma-separated list of allowed CORS origins (optional)

## Security Notes

- Backend runs as dedicated `ladoo` user (non-root)
- UFW firewall only allows SSH (22) and HTTP (80)
- Backend port 8001 is only accessible from localhost
- All traffic goes through Cloudflare Tunnel (HTTPS)
- Logs are rotated daily, kept for 30 days

## Troubleshooting

See `DEPLOYMENT_INSTRUCTIONS.md` for detailed troubleshooting steps.

Common issues:
- Backend not starting: Check `journalctl -u ladoo-metrics`
- Nginx errors: Check `/var/log/nginx/ladoo-metrics-error.log`
- Presto connectivity: May require VPN or network routing
