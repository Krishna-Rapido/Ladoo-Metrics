# Quick Start - VM Deployment

This is a condensed version of the deployment process. For detailed instructions, see `DEPLOYMENT_INSTRUCTIONS.md`.

## Prerequisites

- SSH access to VM: `ssh krishna.poddar@172.18.39.236`
- Root/sudo access

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

# 6. Configure Nginx
cp deployment/nginx-ladoo-metrics.conf /etc/nginx/sites-available/ladoo-metrics
ln -s /etc/nginx/sites-available/ladoo-metrics /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default  # Optional
nginx -t
systemctl reload nginx

# 7. Set up systemd service (backend)
cp deployment/ladoo-metrics.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable ladoo-metrics
systemctl start ladoo-metrics

# 8. Security hardening
bash deployment/security-hardening.sh

# 9. Verify deployment
bash deployment/verify-deployment.sh

# 10. Start Cloudflare Quick Tunnel (no domain needed!)
cp deployment/cloudflare-tunnel.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable cloudflare-tunnel
systemctl start cloudflare-tunnel

# 11. Get your public URL
journalctl -u cloudflare-tunnel --no-pager -n 20 | grep trycloudflare
# Look for a line like: https://random-words.trycloudflare.com
```

## Environment Variables

Edit `/etc/systemd/system/ladoo-metrics.service` to set:

- `PRESTO_HOST` - If different from default
- `PRESTO_PORT` - If different from default (80)

Then restart:
```bash
systemctl daemon-reload
systemctl restart ladoo-metrics
```

## Access the Application

After the Cloudflare Quick Tunnel starts:
- URL: Check `journalctl -u cloudflare-tunnel --no-pager -n 20 | grep trycloudflare`
- The URL looks like: `https://random-words.trycloudflare.com`

> **Note:** The URL changes each time the tunnel service restarts. Run the
> `journalctl` command above to get the current URL.

## Troubleshooting

```bash
# Check backend logs
journalctl -u ladoo-metrics -f

# Check tunnel logs / get public URL
journalctl -u cloudflare-tunnel -f

# Check Nginx logs
tail -f /var/log/nginx/ladoo-metrics-error.log

# Check service status
systemctl status ladoo-metrics
systemctl status nginx
systemctl status cloudflare-tunnel

# Test backend directly
curl http://localhost:8001/health

# Test through Nginx
curl http://localhost/health
```
