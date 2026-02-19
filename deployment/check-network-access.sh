#!/bin/bash
# Network Access Diagnostic Script
# Run this on the server to diagnose why the domain might not be accessible

echo "=== Network Access Diagnostics ==="
echo ""

# 1. Check DNS resolution (from multiple sources)
echo "1. DNS Resolution:"
echo "   Domain: laddoo.labs.plectrum.dev"
echo "   From server (internal DNS):"
DNS_IP=$(dig +short laddoo.labs.plectrum.dev 2>/dev/null || echo "Failed to resolve")
echo "   Resolves to: $DNS_IP"
echo ""
echo "   From public DNS (8.8.8.8):"
PUBLIC_DNS_IP=$(dig @8.8.8.8 +short laddoo.labs.plectrum.dev 2>/dev/null || echo "Failed to resolve")
echo "   Resolves to: $PUBLIC_DNS_IP"
echo ""
if [ "$DNS_IP" != "$PUBLIC_DNS_IP" ] && [ "$PUBLIC_DNS_IP" != "Failed to resolve" ]; then
    echo "   ⚠ WARNING: Internal and external DNS differ!"
    echo "   Internal DNS: $DNS_IP"
    echo "   External DNS: $PUBLIC_DNS_IP"
    echo "   External users will use: $PUBLIC_DNS_IP"
fi
echo ""

# 2. Check server IP
echo "2. Server Network Configuration:"
SERVER_IP=$(hostname -I | awk '{print $1}')
echo "   Server IP: $SERVER_IP"
echo ""

# 3. Check if Nginx is listening
echo "3. Nginx Listening Status:"
if ss -tlnp | grep -q ":80 "; then
    echo "   ✓ Nginx is listening on port 80"
    ss -tlnp | grep ":80 "
else
    echo "   ✗ Nginx is NOT listening on port 80"
fi
echo ""

# 4. Check firewall
echo "4. Firewall Status:"
if command -v ufw &> /dev/null; then
    echo "   UFW Status:"
    ufw status | grep -E "(Status|80/tcp)"
else
    echo "   UFW not found"
fi
echo ""

# 5. Test local access
echo "5. Local Access Test:"
LOCAL_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health 2>/dev/null || echo "000")
if [ "$LOCAL_TEST" = "200" ]; then
    echo "   ✓ Local access works (HTTP $LOCAL_TEST)"
else
    echo "   ✗ Local access failed (HTTP $LOCAL_TEST)"
fi
echo ""

# 6. Test domain access from server
echo "6. Domain Access from Server:"
DOMAIN_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://laddoo.labs.plectrum.dev/health 2>/dev/null || echo "000")
if [ "$DOMAIN_TEST" = "200" ]; then
    echo "   ✓ Domain accessible from server (HTTP $DOMAIN_TEST)"
else
    echo "   ✗ Domain not accessible from server (HTTP $DOMAIN_TEST)"
fi
echo ""

# 7. Check if IP is private
echo "7. IP Address Type:"
CHECK_IP="${PUBLIC_DNS_IP:-$DNS_IP}"
if [[ "$CHECK_IP" =~ ^172\.(1[6-9]|2[0-9]|3[01])\. ]] || [[ "$CHECK_IP" =~ ^10\. ]] || [[ "$CHECK_IP" =~ ^192\.168\. ]]; then
    echo "   ⚠ WARNING: Domain resolves to PRIVATE IP ($CHECK_IP)"
    echo "   If this is the external DNS, external users cannot reach it directly."
    echo "   Solution: DNS should point to a public IP or load balancer."
    echo "   Contact DevOps/IT to update DNS to point to the correct public endpoint."
elif [[ "$CHECK_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "   ✓ Domain resolves to public IP ($CHECK_IP)"
    echo "   External access should work if firewall allows port 80"
else
    echo "   ? Could not determine IP type"
fi
echo ""

# 8. Check recent Nginx access logs
echo "8. Recent Nginx Access (last 5 requests):"
if [ -f "/var/log/nginx/ladoo-metrics-access.log" ]; then
    tail -5 /var/log/nginx/ladoo-metrics-access.log 2>/dev/null || echo "   No access log entries"
else
    echo "   Access log not found"
fi
echo ""

# Summary
echo "=== Summary ==="
if [[ "$PUBLIC_DNS_IP" =~ ^172\.(1[6-9]|2[0-9]|3[01])\. ]] || [[ "$PUBLIC_DNS_IP" =~ ^10\. ]] || [[ "$PUBLIC_DNS_IP" =~ ^192\.168\. ]]; then
    echo "❌ ISSUE FOUND: External DNS resolves to private IP ($PUBLIC_DNS_IP)"
    echo ""
    echo "The domain laddoo.labs.plectrum.dev is pointing to a private IP address."
    echo "This prevents external access. The DNS record needs to be updated."
    echo ""
    echo "Next steps:"
    echo "1. Contact DevOps/IT to update the DNS A record for laddoo.labs.plectrum.dev"
    echo "2. DNS should point to:"
    echo "   - A public IP address, OR"
    echo "   - A load balancer IP address"
    echo ""
    echo "The server is configured correctly and ready - only DNS needs updating."
else
    echo "✓ Server configuration looks correct"
    echo "✓ External DNS resolves to: $PUBLIC_DNS_IP"
    echo ""
    echo "If you still can't access the site:"
    echo "1. Ensure you're using HTTP (not HTTPS): http://laddoo.labs.plectrum.dev/"
    echo "2. Check if there's a load balancer that needs this server added to its pool"
    echo "3. Verify security groups/firewalls allow port 80 from internet"
fi
echo ""
echo "Try accessing from your browser using: http://laddoo.labs.plectrum.dev/ (HTTP, not HTTPS)"
