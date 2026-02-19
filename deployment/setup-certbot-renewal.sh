#!/bin/bash
# Setup script for automatic certbot renewal with DNS-01 challenge
# This configures certbot to use hooks for automatic DNS updates during renewal

set -e

DOMAIN="laddoo.labs.plectrum.dev"
HOOK_SCRIPT="/etc/letsencrypt/renewal-hooks/deploy/certbot-dns-hook.sh"

echo "=== Setting up Certbot automatic renewal with DNS-01 ==="

# Create renewal hooks directory
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
mkdir -p /etc/letsencrypt/renewal-hooks/pre
mkdir -p /etc/letsencrypt/renewal-hooks/post

# Copy the hook script
if [ -f "$(dirname "$0")/certbot-renewal-hook.sh" ]; then
    cp "$(dirname "$0")/certbot-renewal-hook.sh" "$HOOK_SCRIPT"
    chmod +x "$HOOK_SCRIPT"
    echo "✓ Installed renewal hook script"
else
    echo "⚠ Warning: certbot-renewal-hook.sh not found. Creating placeholder..."
    cat > "$HOOK_SCRIPT" << 'EOF'
#!/bin/bash
# Placeholder renewal hook - customize this for your DNS provider
echo "Renewal hook called for $CERTBOT_DOMAIN"
echo "Add DNS TXT record: _acme-challenge.$CERTBOT_DOMAIN = $CERTBOT_VALIDATION"
EOF
    chmod +x "$HOOK_SCRIPT"
fi

# Configure certbot renewal to use manual DNS challenge
# This will be used for renewals
cat > /etc/letsencrypt/renewal/"$DOMAIN".conf << EOF
# Certbot renewal configuration for $DOMAIN
# This file is auto-generated. Manual edits may be overwritten.

# Use manual DNS-01 challenge for renewals
authenticator = manual
manual_auth_hook = $HOOK_SCRIPT
pref_challenges = dns-01

# Certificate paths
cert = /etc/letsencrypt/live/$DOMAIN/cert.pem
privkey = /etc/letsencrypt/live/$DOMAIN/privkey.pem
chain = /etc/letsencrypt/live/$DOMAIN/chain.pem
fullchain = /etc/letsencrypt/live/$DOMAIN/fullchain.pem

# Account and server
account = $(ls -1 /etc/letsencrypt/accounts/ | head -1)
server = https://acme-v02.api.letsencrypt.org/directory
EOF

echo "✓ Configured certbot renewal for $DOMAIN"

# Test renewal (dry run)
echo ""
echo "Testing renewal configuration (dry run)..."
if certbot renew --dry-run --cert-name "$DOMAIN" 2>&1 | grep -q "The dry run was successful"; then
    echo "✓ Dry run successful"
else
    echo "⚠ Dry run had issues (this is OK if certificate doesn't exist yet)"
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "IMPORTANT: Customize $HOOK_SCRIPT to automatically update DNS"
echo "when renewals happen. Currently it requires manual DNS updates."
echo ""
echo "Certificate renewals happen automatically via systemd timer."
echo "Check renewal status: systemctl status certbot.timer"
echo "Test renewal: certbot renew --dry-run"
