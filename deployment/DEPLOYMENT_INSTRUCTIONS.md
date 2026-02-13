# Ladoo Metrics - VM Deployment Instructions

This guide walks you through deploying Ladoo Metrics on the internal Ubuntu VM.

## Prerequisites

Before starting, ensure you have:
- SSH access to the VM: `ssh krishna.poddar@172.18.39.236`
- Root or sudo access on the VM
- **No domain or Cloudflare account needed** — we use a free Quick Tunnel

## Step 1: System Setup

SSH into the VM and run the system setup script:

```bash
ssh krishna.poddar@172.18.39.236
sudo su
cd /tmp
# Upload vm-setup.sh or clone the repo first
bash vm-setup.sh
```

This will install:
- Python 3.10+
- Node.js 18 LTS
- Nginx
- Cloudflared
- UFW firewall
- Creates `ladoo` system user

## Step 2: Clone Repository

Clone the repository to `/opt/ladoo-metrics/`:

```bash
cd /opt
git clone <your-repo-url> ladoo-metrics
# OR if you need to copy from local machine:
# scp -r /path/to/internal_tools_v1 krishna.poddar@172.18.39.236:/opt/ladoo-metrics
```

Set ownership:
```bash
chown -R ladoo:ladoo /opt/ladoo-metrics
```

## Step 3: Deploy Backend

```bash
cd /opt/ladoo-metrics
sudo bash deployment/deploy-backend.sh
```

This creates a Python virtual environment and installs all dependencies.

## Step 4: Deploy Frontend

```bash
cd /opt/ladoo-metrics
sudo bash deployment/deploy-frontend.sh
```

This builds the frontend with production settings.

## Step 5: Configure Nginx

```bash
# Copy Nginx config
cp /opt/ladoo-metrics/deployment/nginx-ladoo-metrics.conf /etc/nginx/sites-available/ladoo-metrics

# Create symlink
ln -s /etc/nginx/sites-available/ladoo-metrics /etc/nginx/sites-enabled/

# Remove default site (optional)
rm /etc/nginx/sites-enabled/default

# Test configuration
nginx -t

# Reload Nginx
systemctl reload nginx
```

## Step 6: Set Up systemd Service

```bash
# Copy systemd service file
cp /opt/ladoo-metrics/deployment/ladoo-metrics.service /etc/systemd/system/

# Reload systemd
systemctl daemon-reload

# Enable service (starts on boot)
systemctl enable ladoo-metrics

# Start service
systemctl start ladoo-metrics

# Check status
systemctl status ladoo-metrics

# View logs
journalctl -u ladoo-metrics -f
```

## Step 7: Set Up Cloudflare Quick Tunnel

A **Quick Tunnel** gives you a free public `https://<random>.trycloudflare.com` URL.
No Cloudflare account, no domain, and no DNS configuration required.

### 7a. Install Cloudflared (if not already installed)

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb \
  -o /tmp/cloudflared.deb && apt install -y /tmp/cloudflared.deb
```

### 7b. Test the Tunnel (optional)

```bash
# Quick smoke test — press Ctrl+C to stop
cloudflared tunnel --url http://localhost:80
# Look for a line like:
#   INF +---------------------------------------------------+
#   INF |  https://random-words-here.trycloudflare.com      |
#   INF +---------------------------------------------------+
```

### 7c. Set Up as a systemd Service

```bash
# Copy service file
cp /opt/ladoo-metrics/deployment/cloudflare-tunnel.service /etc/systemd/system/

# Reload systemd
systemctl daemon-reload

# Enable (starts on boot) and start
systemctl enable cloudflare-tunnel
systemctl start cloudflare-tunnel
```

### 7d. Get Your Public URL

```bash
journalctl -u cloudflare-tunnel --no-pager -n 20 | grep trycloudflare
```

The URL looks like `https://random-words-here.trycloudflare.com`. Open it in a browser to access the Ladoo Metrics UI.

> **Note:** The URL changes every time the `cloudflare-tunnel` service restarts.
> Run the command above to get the current URL after a restart.

## Step 8: Verify Deployment

### 8a. Test Backend Directly

```bash
curl http://localhost:8001/health
# Should return JSON with status: "ok"
```

### 8b. Test Through Nginx

```bash
curl http://localhost/health
# Should return the same JSON
```

### 8c. Test Frontend

```bash
curl http://localhost/
# Should return HTML
```

### 8d. Test Cloudflare Tunnel

Get the URL with `journalctl -u cloudflare-tunnel --no-pager -n 20 | grep trycloudflare`, then open it in a browser. You should see the Ladoo Metrics frontend.

### 8e. Test Presto Connectivity

Use the Captain Dashboards feature to run a query. If Presto is not reachable:
1. Check network connectivity: `ping bi-trino-4.serving.data.production.internal`
2. Verify VPN/routing if needed
3. Update `PRESTO_HOST` in `/etc/systemd/system/ladoo-metrics.service` if different

## Troubleshooting

### Backend Not Starting

```bash
# Check logs
journalctl -u ladoo-metrics -n 50

# Check if port is in use
netstat -tlnp | grep 8001

# Test manually
sudo -u ladoo /opt/ladoo-metrics/backend/venv/bin/python /opt/ladoo-metrics/backend/main.py
```

### Nginx Errors

```bash
# Check Nginx logs
tail -f /var/log/nginx/ladoo-metrics-error.log

# Test configuration
nginx -t

# Check if Nginx is running
systemctl status nginx
```

### Cloudflare Tunnel Not Working

```bash
# Check tunnel logs
journalctl -u cloudflare-tunnel -f

# Test tunnel manually
cloudflared tunnel --config /etc/cloudflared/config.yml run
```

### Presto Connection Issues

1. Verify DNS resolution:
   ```bash
   nslookup bi-trino-4.serving.data.production.internal
   ```

2. Test connectivity:
   ```bash
   telnet bi-trino-4.serving.data.production.internal 80
   ```

3. If unreachable, you may need:
   - VPN connection
   - Network routing configuration
   - Firewall rules

## Security Notes

- Backend runs as `ladoo` user (non-root)
- Only ports 22 (SSH) and 80 (HTTP) are open via UFW
- Backend port 8001 is only accessible from localhost
- All traffic goes through Cloudflare Tunnel (HTTPS)

## Maintenance

### Update Application

```bash
cd /opt/ladoo-metrics
git pull
sudo bash deployment/deploy-backend.sh
sudo bash deployment/deploy-frontend.sh
systemctl restart ladoo-metrics
systemctl reload nginx
```

### View Logs

```bash
# Backend logs
journalctl -u ladoo-metrics -f

# Nginx access logs
tail -f /var/log/nginx/ladoo-metrics-access.log

# Nginx error logs
tail -f /var/log/nginx/ladoo-metrics-error.log
```

### Restart Services

```bash
systemctl restart ladoo-metrics
systemctl restart nginx
systemctl restart cloudflare-tunnel
```
