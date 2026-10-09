#!/usr/bin/env bash
# DuckDNS updater for the wx-ensemble public endpoint.
#
# BLOCKED: DuckDNS accounts are OAuth-only (Google, GitHub, Twitter, Persona).
# There is no self-serve signup, so this cannot be completed without an account
# token from the user. Everything else is ready: run this once the token exists.
#
# Usage:
#   sudo install -m 0600 duckdns.env /etc/pocket-relay-miner/duckdns.env   # fill it in
#   bash duckdns-update.sh
#
# Then re-point the staked supplier endpoint and the service card at the new
# hostname, because BOTH name the endpoint:
#   - supplier stake config  deploy/supplier-stake.yaml  -> publicly_exposed_url
#   - service card           card.min.json               -> specs[].url
#   - nginx                  server_name + cert
set -u
set -a; . /etc/pocket-relay-miner/duckdns.env 2>/dev/null; set +a

if [ -z "${DUCKDNS_DOMAIN:-}" ] || [ -z "${DUCKDNS_TOKEN:-}" ]; then
  echo "DUCKDNS_DOMAIN and DUCKDNS_TOKEN must be set in /etc/pocket-relay-miner/duckdns.env"
  echo
  echo "To get them:"
  echo "  1. Log in at https://www.duckdns.org (Google, GitHub, Twitter or Persona)"
  echo "  2. Create a subdomain, e.g. wx-ensemble.duckdns.org"
  echo "  3. Copy the token shown on the dashboard"
  echo "  4. Put both in /etc/pocket-relay-miner/duckdns.env as:"
  echo "       DUCKDNS_DOMAIN=wx-ensemble"
  echo "       DUCKDNS_TOKEN=<the token>"
  echo
  echo "The token is a DNS-update credential. Do not paste it into chat. Put it"
  echo "directly into that file on the box; it is mode 0600."
  exit 1
fi

IP=$(curl -s --max-time 15 https://api.ipify.org || curl -s --max-time 15 https://ifconfig.me)
echo "detected IP: $IP"

RESP=$(curl -s --max-time 20 "https://www.duckdns.org/update?domains=${DUCKDNS_DOMAIN}&token=${DUCKDNS_TOKEN}&ip=${IP}&verbose=true")
echo "duckdns response: $RESP"

if echo "$RESP" | head -1 | grep -q '^OK'; then
  echo
  echo "Record updated. Next steps to complete the switch:"
  echo "  1. Wait for DNS: dig +short ${DUCKDNS_DOMAIN}.duckdns.org"
  echo "  2. Get a cert for ${DUCKDNS_DOMAIN}.duckdns.org and update nginx server_name"
  echo "  3. Update deploy/supplier-stake.yaml publicly_exposed_url"
  echo "     and re-run: pocketd tx supplier stake-supplier --services-only"
  echo "  4. Rebuild card.min.json with the new specs[].url and re-run add-service"
else
  echo "UPDATE FAILED (KO). Check the domain and token."
  exit 1
fi
