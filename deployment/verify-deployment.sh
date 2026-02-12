#!/bin/bash
# Deployment Verification Script
# Run this script to verify all components are working

set -e

echo "=== Ladoo Metrics Deployment Verification ==="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

check() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $1"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $1"
        ((FAILED++))
        return 1
    fi
}

# 1. Check system services
echo "=== System Services ==="
systemctl is-active --quiet ladoo-metrics && check "Backend service (ladoo-metrics) is running" || check "Backend service (ladoo-metrics) is running"
systemctl is-active --quiet nginx && check "Nginx service is running" || check "Nginx service is running"
systemctl is-enabled --quiet ladoo-metrics && check "Backend service is enabled (starts on boot)" || check "Backend service is enabled (starts on boot)"
echo ""

# 2. Check backend health
echo "=== Backend Health ==="
BACKEND_HEALTH=$(curl -s http://localhost:8001/health 2>/dev/null)
if echo "$BACKEND_HEALTH" | grep -q '"status":"ok"'; then
    check "Backend health check (direct)"
    echo "  Response: $BACKEND_HEALTH"
else
    check "Backend health check (direct)"
    echo "  Error: Backend not responding"
fi
echo ""

# 3. Check Nginx proxy
echo "=== Nginx Proxy ==="
# Note: This will fail if basic auth is not set up, which is expected
NGINX_TEST=$(curl -s -w "%{http_code}" -o /dev/null http://localhost/health 2>/dev/null || echo "000")
if [ "$NGINX_TEST" = "401" ] || [ "$NGINX_TEST" = "200" ]; then
    check "Nginx is responding (HTTP $NGINX_TEST)"
else
    check "Nginx is responding"
    echo "  Warning: Got HTTP $NGINX_TEST (401 is expected if auth not configured)"
fi
echo ""

# 4. Check frontend build
echo "=== Frontend Build ==="
if [ -d "/opt/ladoo-metrics/frontend/dist" ]; then
    check "Frontend dist directory exists"
    if [ -f "/opt/ladoo-metrics/frontend/dist/index.html" ]; then
        check "Frontend index.html exists"
    else
        check "Frontend index.html exists"
    fi
else
    check "Frontend dist directory exists"
fi
echo ""

# 5. Check file permissions
echo "=== File Permissions ==="
if [ -d "/opt/ladoo-metrics" ]; then
    OWNER=$(stat -c '%U' /opt/ladoo-metrics 2>/dev/null || echo "unknown")
    if [ "$OWNER" = "ladoo" ]; then
        check "Application directory owned by 'ladoo' user"
    else
        check "Application directory owned by 'ladoo' user"
        echo "  Warning: Owner is '$OWNER', expected 'ladoo'"
    fi
else
    check "Application directory exists"
fi
echo ""

# 6. Check firewall
echo "=== Firewall ==="
if command -v ufw &> /dev/null; then
    UFW_STATUS=$(ufw status | grep -i "Status: active" || echo "inactive")
    if echo "$UFW_STATUS" | grep -q "active"; then
        check "UFW firewall is active"
    else
        check "UFW firewall is active"
        echo "  Warning: UFW is not active"
    fi
else
    check "UFW firewall installed"
    echo "  Warning: UFW not found"
fi
echo ""

# 7. Check Presto connectivity (optional)
echo "=== Presto Connectivity (Optional) ==="
PRESTO_HOST="${PRESTO_HOST:-bi-trino-4.serving.data.production.internal}"
if timeout 5 bash -c "echo > /dev/tcp/$PRESTO_HOST/80" 2>/dev/null; then
    check "Presto host is reachable ($PRESTO_HOST:80)"
else
    check "Presto host is reachable ($PRESTO_HOST:80)"
    echo "  Info: Presto may require VPN or network routing"
fi
echo ""

# 8. Check Cloudflare Tunnel (if configured)
echo "=== Cloudflare Tunnel ==="
if systemctl is-active --quiet cloudflare-tunnel 2>/dev/null; then
    check "Cloudflare Tunnel service is running"
else
    check "Cloudflare Tunnel service is running"
    echo "  Info: Cloudflare Tunnel not configured or not running"
fi
echo ""

# Summary
echo "=== Summary ==="
echo -e "${GREEN}Passed: $PASSED${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Failed: $FAILED${NC}"
    echo ""
    echo "Some checks failed. Review the output above for details."
    exit 1
else
    echo -e "${GREEN}All checks passed!${NC}"
    exit 0
fi
