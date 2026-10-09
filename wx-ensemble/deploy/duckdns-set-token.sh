#!/usr/bin/env bash
# Store the DuckDNS credential without it ever appearing in a message.
#
# WHY THIS EXISTS: the token must get from the user's keyboard into a root-only
# file without passing through any chat transcript. This script reads it with
# echo suppressed, validates the shape, and writes it directly.
#
#   bash /home/ubuntu/pocket-hackathon/wx-ensemble/deploy/duckdns-set-token.sh
#
# The token is never printed, never logged, and never placed in shell history.
set -uo pipefail

OUT="/etc/pocket-relay-miner/duckdns.env"
DOMAIN="wx-ensemble"

echo "Setting the DuckDNS credential for ${DOMAIN}.duckdns.org"
echo
echo "Paste the token and press Enter. Nothing will appear as you type."
echo "(If you already sent it in chat, DELETE IT on the DuckDNS dashboard first"
echo " and paste the fresh one here.)"
echo

read -rsp "DuckDNS token: " TOKEN
echo
echo

# DuckDNS tokens are UUIDs. Validate the shape so a stray paste or a truncated
# value is caught here rather than failing mysteriously later.
if ! [[ "$TOKEN" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]; then
  echo "REJECTED: that does not look like a DuckDNS token."
  echo "Expected a UUID like 12345678-1234-1234-1234-123456789abc"
  echo "Nothing was written."
  exit 1
fi

TMP=$(mktemp)
chmod 600 "$TMP"
cat > "$TMP" <<EOF
# DuckDNS credential for wx-ensemble. Written $(date -u +%Y-%m-%dT%H:%M:%SZ).
# Mode 600. Never commit. Never echo.
DUCKDNS_DOMAIN=${DOMAIN}
DUCKDNS_TOKEN=${TOKEN}
EOF

sudo install -m 0600 -o root -g root "$TMP" "$OUT"
shred -u "$TMP" 2>/dev/null || rm -f "$TMP"
unset TOKEN

echo "Saved to ${OUT} with mode $(stat -c '%a' "$OUT" 2>/dev/null)."
echo "The token is not shown here and is not in your shell history."
echo
echo "Next: tell the assistant to run deploy/duckdns-switch.sh"
