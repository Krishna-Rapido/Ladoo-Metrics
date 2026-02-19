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

# 6a. Fix firewall rules (ensure port 80 is accessible)
bash deployment/fix-firewall.sh

# 7. Set up systemd service (backend)
cp deployment/ladoo-metrics.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable ladoo-metrics
systemctl start ladoo-metrics

# 8. Security hardening
bash deployment/security-hardening.sh

# 9. Verify deployment
bash deployment/verify-deployment.sh
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

After deployment:
- **URL:** `http://laddoo.labs.plectrum.dev/` (note: HTTP, not HTTPS)
- The application is accessible via HTTP on the configured domain
- Server is configured to accept requests from load balancers/reverse proxies
- Firewall rules allow port 80 access

## Troubleshooting Domain Access

If `http://172.18.39.236/` works but `http://laddoo.labs.plectrum.dev/` doesn't:

1. **Run diagnostic script on server:**
   ```bash
   bash deployment/diagnose-domain-access.sh
   ```

2. **See detailed fix guide:**
   - Read `deployment/FIX_DOMAIN_ACCESS.md` for step-by-step troubleshooting
   - Common causes: DNS resolution on client, browser cache, network routing

3. **Quick checks:**
   ```bash
   # On server - verify it responds to domain
   curl http://laddoo.labs.plectrum.dev/health
   
   # On your machine - check DNS resolution
   nslookup laddoo.labs.plectrum.dev
   # Should return: 172.18.39.236
   ```

## Troubleshooting

### Nginx Not Running

If Nginx service is not running, try these steps:

```bash
# 1. Check Nginx status and errors
systemctl status nginx

# 2. Check for configuration errors
nginx -t

# 3. Check if port 80 is already in use
netstat -tlnp | grep :80
# or
ss -tlnp | grep :80

# 4. Check Nginx error logs
tail -20 /var/log/nginx/error.log
journalctl -u nginx -n 50

# 5. If configuration is valid, try starting Nginx
systemctl start nginx

# 6. Enable Nginx to start on boot
systemctl enable nginx

# 7. If Nginx fails to start, check for syntax errors in config
nginx -T  # Shows full configuration with file locations

# 8. Common issues:
# - Port 80 already in use: Stop conflicting service or change Nginx port
# - Configuration syntax error: Fix errors shown by 'nginx -t'
# - Missing directories: Ensure /opt/ladoo-metrics/frontend/dist exists
# - Permission issues: Check file permissions on config and log directories
```

### Connection Timeout / Cannot Access Domain

If you get `ERR_CONNECTION_TIMED_OUT` when accessing `laddoo.labs.plectrum.dev`:

**1. Use HTTP, not HTTPS**
- The site is configured for HTTP only: `http://laddoo.labs.plectrum.dev/`
- Do NOT use `https://` - SSL certificates are not configured

**2. Check DNS Resolution**
```bash
# From your local machine (not the server)
dig +short laddoo.labs.plectrum.dev
nslookup laddoo.labs.plectrum.dev

# Should return the IP address (may be private IP 172.18.39.236 or public IP)
```

**3. Check Network Access**
Since the server is on private IP `172.18.39.236`, verify:
- Is there a load balancer or reverse proxy in front?
- Is port 80 exposed to the internet?
- Are security groups/firewalls allowing traffic on port 80?

**4. Test from Server (should work)**
```bash
# On the server, test locally
curl http://localhost/health
curl http://laddoo.labs.plectrum.dev/health

# Check if Nginx is listening on all interfaces
netstat -tlnp | grep :80
# Should show: 0.0.0.0:80 (listening on all interfaces)
```

**5. Check Firewall Rules**
```bash
# On the server
ufw status verbose
# Should show: 80/tcp ALLOW

# Check if iptables is blocking
iptables -L -n | grep 80
```

**6. Run Network Diagnostic Script**
```bash
# Run comprehensive network diagnostics
bash deployment/check-network-access.sh
```

**7. Verify Nginx Configuration**
```bash
# Check Nginx is listening correctly
ss -tlnp | grep :80

# Check Nginx access logs for incoming requests
tail -f /var/log/nginx/ladoo-metrics-access.log

# Test Nginx configuration
nginx -t
```

**7. Network Infrastructure Check**
If the domain points to a private IP, you may need:
- Load balancer configuration to route traffic to this server
- NAT/port forwarding rules
- Security group rules allowing port 80 from internet
- VPN connection if accessing from outside the network

### General Troubleshooting

```bash
# Check backend logs
journalctl -u ladoo-metrics -f

# Check Nginx logs
tail -f /var/log/nginx/ladoo-metrics-error.log
tail -f /var/log/nginx/ladoo-metrics-access.log

# Check service status
systemctl status ladoo-metrics
systemctl status nginx

# Test backend directly
curl http://localhost:8001/health

# Test through Nginx
curl http://localhost/health

# Test via domain (from server)
curl http://laddoo.labs.plectrum.dev/health

# Check DNS resolution
dig +short laddoo.labs.plectrum.dev
```
