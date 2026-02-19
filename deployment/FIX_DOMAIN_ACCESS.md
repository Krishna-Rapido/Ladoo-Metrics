# Fix Domain Access Issue

## Problem
- ✅ Works: `http://172.18.39.236/`
- ❌ Doesn't work: `http://laddoo.labs.plectrum.dev/`

## Root Cause Analysis

The server is configured correctly:
- ✅ Nginx is listening on port 80
- ✅ Server responds to IP address
- ✅ Server responds when Host header is set correctly
- ✅ DNS resolves to correct IP (172.18.39.236)
- ✅ Firewall allows port 80

**The issue is likely one of these:**

1. **DNS Resolution on Client Machine**: Your browser/computer might not be resolving the domain correctly
2. **Network Routing**: There might be a load balancer or proxy in front that needs configuration
3. **Browser Cache**: Your browser might have cached a failed DNS lookup

## Step-by-Step Fix Guide

### Step 1: Verify DNS Resolution on Your Machine

On your local machine (not the server), run:

```bash
# Check DNS resolution
nslookup laddoo.labs.plectrum.dev
# OR
dig laddoo.labs.plectrum.dev

# Should return: 172.18.39.236
```

**If DNS doesn't resolve correctly:**
- Check your network's DNS settings
- Try using a different DNS server: `dig @8.8.8.8 laddoo.labs.plectrum.dev`
- Contact your network admin if you're on a corporate network

### Step 2: Check Browser DNS Cache

**Chrome/Edge:**
1. Open: `chrome://net-internals/#dns`
2. Click "Clear host cache"
3. Try accessing the site again

**Firefox:**
1. Open: `about:networking#dns`
2. Click "Clear DNS Cache"
3. Try accessing the site again

**Safari:**
- Clear browser cache: Safari → Preferences → Advanced → "Show Develop menu" → Develop → Empty Caches

### Step 3: Test Direct Connection

Try accessing the domain with curl from your machine:

```bash
# Test if domain resolves and connects
curl -v http://laddoo.labs.plectrum.dev/health

# Check what IP it's connecting to
curl -v http://laddoo.labs.plectrum.dev/health 2>&1 | grep "Trying"
```

**Expected output:** Should show `Trying 172.18.39.236...`

**If it shows a different IP:** DNS is resolving incorrectly on your machine

### Step 4: Check Network Path

If you're behind a corporate network/VPN:

```bash
# Check if there's a proxy
echo $http_proxy
echo $https_proxy

# Test direct connection bypassing proxy
curl --noproxy "*" -v http://laddoo.labs.plectrum.dev/health
```

### Step 5: Verify Server Configuration

On the server, verify Nginx is configured correctly:

```bash
# Check Nginx config
sudo nginx -T | grep -A 5 "server_name"

# Should show: server_name laddoo.labs.plectrum.dev _;

# Test with Host header
curl -H "Host: laddoo.labs.plectrum.dev" http://172.18.39.236/health

# Check Nginx logs for domain requests
sudo tail -f /var/log/nginx/ladoo-metrics-access.log
```

### Step 6: Check for Load Balancer/Proxy

If there's infrastructure in front of the server:

1. **Check if there's a load balancer:**
   - The domain might point to a load balancer IP
   - The load balancer needs to forward to 172.18.39.236:80
   - Check with DevOps/IT if load balancer backend pool includes this server

2. **Check if there's a reverse proxy:**
   - Verify proxy configuration includes this server
   - Ensure Host header is being forwarded correctly

### Step 7: Temporary Workaround

If DNS is the issue and you need immediate access:

**Option A: Use /etc/hosts file (Linux/Mac)**
```bash
sudo nano /etc/hosts
# Add this line:
172.18.39.236  laddoo.labs.plectrum.dev
```

**Option B: Use IP directly**
- Use `http://172.18.39.236/` until DNS is fixed

## Verification

After applying fixes, verify:

```bash
# 1. DNS resolves correctly
dig +short laddoo.labs.plectrum.dev
# Should return: 172.18.39.236

# 2. Can connect to domain
curl -I http://laddoo.labs.plectrum.dev/health
# Should return: HTTP/1.1 200 OK

# 3. Browser can access
# Open: http://laddoo.labs.plectrum.dev/
```

## Common Issues and Solutions

### Issue: "This site can't be reached" / Connection timeout
**Cause:** DNS not resolving or network routing issue
**Solution:** 
- Verify DNS resolution (Step 1)
- Check network connectivity
- Verify firewall rules on server

### Issue: "404 Not Found" or wrong site
**Cause:** Nginx not matching Host header
**Solution:** Already fixed - server_name includes `_` to match any host

### Issue: Works on server but not from your machine
**Cause:** DNS resolution difference between server and client
**Solution:** 
- Check DNS on your machine (Step 1)
- Clear browser cache (Step 2)
- Use /etc/hosts workaround (Step 7)

## Server Status

The server is correctly configured:
- ✅ Nginx listening on 0.0.0.0:80 (all interfaces)
- ✅ server_name accepts any Host header
- ✅ Firewall allows port 80
- ✅ Application is running and responding

The issue is **client-side DNS resolution or network routing**, not server configuration.
