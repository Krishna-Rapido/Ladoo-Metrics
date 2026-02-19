#!/bin/bash
# Certbot renewal hook for DNS-01 challenge
# This script is called by certbot during certificate renewal
# Place this at: /etc/letsencrypt/renewal-hooks/deploy/certbot-dns-hook.sh

set -e

DOMAIN="laddoo.labs.plectrum.dev"
DNS_RECORD_NAME="_acme-challenge.laddoo.labs.plectrum.dev"

# This script will be called by certbot with environment variables:
# CERTBOT_DOMAIN - the domain being validated
# CERTBOT_VALIDATION - the validation string to add as TXT record

if [ "$CERTBOT_DOMAIN" != "$DOMAIN" ]; then
    echo "Domain mismatch: $CERTBOT_DOMAIN != $DOMAIN"
    exit 0
fi

echo "Certbot renewal hook triggered for $CERTBOT_DOMAIN"
echo "Validation string: $CERTBOT_VALIDATION"

# ============================================================================
# CUSTOMIZE THIS SECTION FOR YOUR DNS PROVIDER
# ============================================================================
# 
# Option 1: If you have DNS API access (Cloudflare, Route53, etc.):
# - Install the appropriate certbot DNS plugin
# - Or use API calls here to add/remove TXT records
#
# Option 2: Manual DNS update (current approach):
# - This script will log what needs to be done
# - You'll need to manually update DNS when renewals happen
# - Or integrate with your DNS provider's API
#
# Example for Cloudflare API (if you have API token):
# curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records" \
#   -H "Authorization: Bearer {api_token}" \
#   -H "Content-Type: application/json" \
#   --data '{"type":"TXT","name":"'$DNS_RECORD_NAME'","content":"'$CERTBOT_VALIDATION'","ttl":120}'
#
# Example for AWS Route53 (if you have AWS CLI configured):
# aws route53 change-resource-record-sets --hosted-zone-id {zone_id} \
#   --change-batch '{"Changes":[{"Action":"UPSERT","ResourceRecordSet":{"Name":"'$DNS_RECORD_NAME'","Type":"TXT","TTL":120,"ResourceRecords":[{"Value":"\"'$CERTBOT_VALIDATION'\""}]}}]}'
#
# ============================================================================

# For now, log the required DNS update
echo "=========================================="
echo "ACTION REQUIRED: Update DNS TXT Record"
echo "=========================================="
echo "Record Name: $DNS_RECORD_NAME"
echo "Record Type: TXT"
echo "Record Value: $CERTBOT_VALIDATION"
echo "TTL: 120 (or default)"
echo ""
echo "Add this TXT record to your DNS provider."
echo "Wait for DNS propagation, then certbot will continue."
echo "=========================================="

# Wait for user to add DNS record (in manual mode)
# In automated mode with API, you would add the record here and wait for propagation
sleep 60  # Give DNS time to propagate

# Verify DNS propagation
echo "Verifying DNS propagation..."
for i in {1..12}; do
    DNS_VALUE=$(dig +short TXT "$DNS_RECORD_NAME" | tr -d '"' || echo "")
    if echo "$DNS_VALUE" | grep -q "$CERTBOT_VALIDATION"; then
        echo "✓ DNS record found: $DNS_VALUE"
        exit 0
    fi
    echo "Waiting for DNS propagation... (attempt $i/12)"
    sleep 10
done

echo "⚠ Warning: DNS record not found after 2 minutes"
echo "Certbot may fail. Please verify the TXT record was added correctly."
exit 1
