# Ladoo Metrics - VM Deployment Instructions

This guide walks you through deploying Ladoo Metrics on the internal Ubuntu VM.

## Prerequisites

Before starting, ensure you have:
- SSH access to the VM: `ssh krishna.poddar@172.18.39.236`
- Root or sudo access on the VM
- A Cloudflare account with a domain managed in Cloudflare
- Basic auth username and password ready

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

### 5a. Create Basic Auth Password File

```bash
# Create password file (replace 'username' with your desired username)
htpasswd -c /etc/nginx/.htpasswd username
# Enter password when prompted
# For additional users later: htpasswd /etc/nginx/.htpasswd anotheruser
```

### 5b. Install Nginx Configuration

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

## Step 7: Configure Cloudflare Tunnel

### 7a. Authenticate Cloudflared

```bash
cloudflared tunnel login
# This will open a browser - authenticate with your Cloudflare account
```

### 7b. Create Tunnel

```bash
cloudflared tunnel create ladoo-metrics
# Note the tunnel ID from the output
```

### 7c. Create Configuration

Create `/etc/cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: ladoo-metrics.<your-domain>
    service: http://localhost:80
  - service: http_status:404
```

Replace:
- `<TUNNEL_ID>` with the ID from step 7b
- `<your-domain>` with your Cloudflare-managed domain

### 7d. Create DNS Record

In Cloudflare dashboard:
1. Go to your domain's DNS settings
2. Add a CNAME record:
   - Name: `ladoo-metrics`
   - Target: `<TUNNEL_ID>.cfargotunnel.com`
   - Proxy: Enabled (orange cloud)

### 7e. Set Up Cloudflared Service

```bash
# Copy service file
cp /opt/ladoo-metrics/deployment/cloudflare-tunnel.service /etc/systemd/system/

# Reload systemd
systemctl daemon-reload

# Enable and start
systemctl enable cloudflare-tunnel
systemctl start cloudflare-tunnel

# Check status
systemctl status cloudflare-tunnel
```

## Step 8: Verify Deployment

### 8a. Test Backend Directly

```bash
curl http://localhost:8001/health
# Should return JSON with status: "ok"
```

### 8b. Test Through Nginx

```bash
curl -u username:password http://localhost/health
# Should return the same JSON
```

### 8c. Test Frontend

```bash
curl -u username:password http://localhost/
# Should return HTML
```

### 8d. Test Cloudflare Tunnel

Visit `https://ladoo-metrics.<your-domain>` in a browser. You should see:
1. Basic auth prompt
2. After authentication, the Ladoo Metrics frontend

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

- Basic auth password file is at `/etc/nginx/.htpasswd` - keep it secure
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
