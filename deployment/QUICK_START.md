# Quick Start - VM Deployment

This is a condensed version of the deployment process. For detailed instructions, see `DEPLOYMENT_INSTRUCTIONS.md`.

## Prerequisites

- SSH access to VM: `ssh krishna.poddar@172.18.39.236`
- Root/sudo access
- Cloudflare account with a domain
- Basic auth username/password ready

## Deployment Steps

```bash
# 1. SSH into VM
ssh krishna.poddar@172.18.39.236
sudo su

# 2. System setup
cd /tmp
# Upload or clone the repo first, then:
bash /opt/ladoo-metrics/deployment/vm-setup.sh

# 3. Clone repository (if not already done)
cd /opt
git clone <your-repo-url> ladoo-metrics
chown -R ladoo:ladoo ladoo-metrics

# 4. Deploy backend
cd /opt/ladoo-metrics
bash deployment/deploy-backend.sh

# 5. Deploy frontend
bash deployment/deploy-frontend.sh

# 6. Create Nginx password file
htpasswd -c /etc/nginx/.htpasswd <username>
# Enter password when prompted

# 7. Configure Nginx
cp deployment/nginx-ladoo-metrics.conf /etc/nginx/sites-available/ladoo-metrics
ln -s /etc/nginx/sites-available/ladoo-metrics /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default  # Optional
nginx -t
systemctl reload nginx

# 8. Set up systemd service
cp deployment/ladoo-metrics.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable ladoo-metrics
systemctl start ladoo-metrics

# 9. Security hardening
bash deployment/security-hardening.sh

# 10. Verify deployment
bash deployment/verify-deployment.sh

# 11. Configure Cloudflare Tunnel (see DEPLOYMENT_INSTRUCTIONS.md for details)
cloudflared tunnel login
cloudflared tunnel create ladoo-metrics
# Create /etc/cloudflared/config.yml (see instructions)
# Add DNS CNAME in Cloudflare dashboard
cp deployment/cloudflare-tunnel.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable cloudflare-tunnel
systemctl start cloudflare-tunnel
```

## Environment Variables

Edit `/etc/systemd/system/ladoo-metrics.service` to set:

- `ALLOWED_ORIGINS` - Your Cloudflare tunnel URL (e.g., `https://ladoo-metrics.example.com`)
- `PRESTO_HOST` - If different from default
- `PRESTO_PORT` - If different from default (80)

Then restart:
```bash
systemctl daemon-reload
systemctl restart ladoo-metrics
```

## Access the Application

After Cloudflare Tunnel is configured:
- URL: `https://ladoo-metrics.<your-domain>`
- Authentication: Basic auth (username/password from step 6)

## Troubleshooting

```bash
# Check backend logs
journalctl -u ladoo-metrics -f

# Check Nginx logs
tail -f /var/log/nginx/ladoo-metrics-error.log

# Check service status
systemctl status ladoo-metrics
systemctl status nginx
systemctl status cloudflare-tunnel

# Test backend directly
curl http://localhost:8001/health

# Test through Nginx
curl -u username:password http://localhost/health
```
