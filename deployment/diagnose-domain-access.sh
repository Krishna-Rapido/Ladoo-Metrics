#!/bin/bash
# Diagnostic script to check why domain access might not be working
# Run this on the SERVER to verify configuration

echo "=== Domain Access Diagnostic (Server Side) ==="
echo ""

DOMAIN="laddoo.labs.plectrum.dev"
SERVER_IP="172.18.39.236"

# 1. Check DNS resolution
echo "1. DNS Resolution:"
DNS_IP=$(dig +short $DOMAIN 2>/dev/null || echo "Failed")
echo "   $DOMAIN resolves to: $DNS_IP"
if [ "$DNS_IP" = "$SERVER_IP" ]; then
    echo "   ✓ DNS resolves correctly"
else
    echo "   ✗ DNS mismatch! Expected $SERVER_IP, got $DNS_IP"
fi
echo ""

# 2. Check Nginx configuration
echo "2. Nginx Configuration:"
if nginx -t &>/dev/null; then
    echo "   ✓ Nginx config is valid"
    SERVER_NAME=$(nginx -T 2>/dev/null | grep "server_name" | grep -v "#" | head -1 | awk '{print $2}')
    echo "   Server name configured: $SERVER_NAME"
    if echo "$SERVER_NAME" | grep -q "_"; then
        echo "   ✓ Nginx accepts any Host header (includes _)"
    fi
else
    echo "   ✗ Nginx config has errors"
    nginx -t
fi
echo ""

# 3. Test server response
echo "3. Server Response Tests:"
echo "   Testing with IP address:"
IP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://$SERVER_IP/health 2>/dev/null || echo "000")
if [ "$IP_RESPONSE" = "200" ]; then
    echo "   ✓ IP access works (HTTP $IP_RESPONSE)"
else
    echo "   ✗ IP access failed (HTTP $IP_RESPONSE)"
fi

echo "   Testing with domain name:"
DOMAIN_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN/health 2>/dev/null || echo "000")
if [ "$DOMAIN_RESPONSE" = "200" ]; then
    echo "   ✓ Domain access works from server (HTTP $DOMAIN_RESPONSE)"
else
    echo "   ✗ Domain access failed from server (HTTP $DOMAIN_RESPONSE)"
fi

echo "   Testing with Host header:"
HOST_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: $DOMAIN" http://$SERVER_IP/health 2>/dev/null || echo "000")
if [ "$HOST_RESPONSE" = "200" ]; then
    echo "   ✓ Host header works (HTTP $HOST_RESPONSE)"
else
    echo "   ✗ Host header failed (HTTP $HOST_RESPONSE)"
fi
echo ""

# 4. Check Nginx listening
echo "4. Nginx Listening Status:"
if ss -tlnp | grep -q ":80 "; then
    echo "   ✓ Nginx is listening on port 80"
    ss -tlnp | grep ":80 " | head -1
else
    echo "   ✗ Nginx is NOT listening on port 80"
fi
echo ""

# 5. Check firewall
echo "5. Firewall Status:"
if command -v ufw &>/dev/null; then
    if ufw status | grep -q "80/tcp.*ALLOW"; then
        echo "   ✓ UFW allows port 80"
    else
        echo "   ✗ UFW does NOT allow port 80"
    fi
fi

if iptables -L INPUT -n | grep -q "tcp dpt:80"; then
    echo "   ✓ iptables allows port 80"
else
    echo "   ✗ iptables does NOT allow port 80"
fi
echo ""

# 6. Recent access logs
echo "6. Recent Access Logs (last 3 requests):"
if [ -f "/var/log/nginx/ladoo-metrics-access.log" ]; then
    tail -3 /var/log/nginx/ladoo-metrics-access.log 2>/dev/null | while read line; do
        echo "   $line"
    done
else
    echo "   No access log found"
fi
echo ""

# Summary
echo "=== Summary ==="
if [ "$IP_RESPONSE" = "200" ] && [ "$DOMAIN_RESPONSE" = "200" ]; then
    echo "✓ Server is configured correctly and responding"
    echo ""
    echo "If domain doesn't work from your browser, the issue is likely:"
    echo "  1. DNS resolution on your local machine"
    echo "  2. Browser DNS cache"
    echo "  3. Network routing/proxy configuration"
    echo ""
    echo "See FIX_DOMAIN_ACCESS.md for client-side troubleshooting steps"
else
    echo "✗ Server configuration issue detected"
    echo "Review the errors above and fix server configuration"
fi
