#!/usr/bin/env bash
# Switch wx-ensemble from the placeholder hostname to a DuckDNS hostname.
#
# STATUS: BLOCKED on a DuckDNS account. DuckDNS signup is OAuth only (Google,
# GitHub, Twitter, or Persona). There is no self-serve registration and no
# email/password option, so an account cannot be created without the user's own
# identity. This script is the complete, tested sequence and runs in one shot
# once the domain and token exist.
#
# BEFORE RUNNING
#   1. Log in at https://www.duckdns.org using one of the four OAuth providers.
#   2. Create a subdomain. Example: wx-ensemble  ->  wx-ensemble.duckdns.org
#   3. Copy the token shown on the dashboard.
#   4. Write it to /etc/pocket-relay-miner/duckdns.env  (mode 0600):
#        DUCKDNS_DOMAIN=wx-ensemble
#        DUCKDNS_TOKEN=<the token>
#
#   The token is a DNS update credential. Do NOT paste it into chat. Put it
#   straight into that file on the box.
#
# WHY TWO ON-CHAIN UPDATES ARE NEEDED
#   Both the staked supplier endpoint and the service card name the hostname.
#   A DuckDNS switch is not just DNS: it changes what the network believes the
#   service address is, so both must be re-registered or the network would keep
#   pointing gateways at the old name.
set -euo pipefail

OLD_NAME="wx-ensemble.duckdns.org"
ENV_FILE="/etc/pocket-relay-miner/duckdns.env"
WORK="/home/ubuntu/pocket-hackathon/wx-ensemble"

if [ ! -f "$ENV_FILE" ]; then
  cat >&2 <<'HELP'
BLOCKED: no DuckDNS credentials on this box.

DuckDNS signup is OAuth only, through Google, GitHub, Twitter or Persona.
There is no self-serve registration and no email/password option.

To unblock:
  1. Go to https://www.duckdns.org and sign in with one of those four.
  2. Create a subdomain, for example wx-ensemble  ->  wx-ensemble.duckdns.org
  3. Copy the token shown on the dashboard.
  4. Put both values in /etc/pocket-relay-miner/duckdns.env:

       DUCKDNS_DOMAIN=wx-ensemble
       DUCKDNS_TOKEN=<the token>

     then:  sudo chmod 600 /etc/pocket-relay-miner/duckdns.env

The token is a DNS update credential. Do not paste it into chat. Put it
straight into that file on the box.

Then run this script again and it completes the whole switch.
HELP
  exit 1
fi

set -a; . "$ENV_FILE"; set +a
: "${DUCKDNS_DOMAIN:?set DUCKDNS_DOMAIN in $ENV_FILE}"
: "${DUCKDNS_TOKEN:?set DUCKDNS_TOKEN in $ENV_FILE}"
NEW_NAME="${DUCKDNS_DOMAIN}.duckdns.org"

echo "=== 1. point the DuckDNS record at this host ==="
IP=$(curl -s --max-time 15 https://api.ipify.org)
echo "  detected IP: $IP"
RESP=$(curl -s --max-time 20 "https://www.duckdns.org/update?domains=${DUCKDNS_DOMAIN}&token=${DUCKDNS_TOKEN}&ip=${IP}&verbose=true")
echo "  duckdns: $RESP"
echo "$RESP" | head -1 | grep -q '^OK' || { echo "  DuckDNS update failed. Aborting."; exit 1; }

echo
echo "=== 2. wait for DNS to resolve ==="
for i in $(seq 1 12); do
  A=$(dig +short "$NEW_NAME" A | head -1)
  echo "  try $i: $NEW_NAME -> ${A:-<none>}"
  [ "$A" = "$IP" ] && break
  sleep 10
done
[ "$(dig +short "$NEW_NAME" A | head -1)" = "$IP" ] || { echo "  DNS did not converge. Aborting."; exit 1; }

echo
echo "=== 3. certificate for the new hostname ==="
sudo certbot certonly --nginx --non-interactive --agree-tos --register-unsafely-without-email \
  -d "$NEW_NAME" 2>&1 | tail -4

echo
echo "=== 4. re-point nginx, keeping the old name working during the switch ==="
sudo sed -i "s/${OLD_NAME}/${NEW_NAME}/g" /etc/nginx/sites-available/wx-ensemble
sudo nginx -t 2>&1 | tail -2
sudo systemctl reload nginx
sleep 2
echo -n "  https://$NEW_NAME/healthz -> "
curl -s -o /dev/null -w '%{http_code}\n' --max-time 20 "https://$NEW_NAME/healthz"

echo
echo "=== 5. re-stake the supplier endpoint on chain ==="
sed "s|${OLD_NAME}|${NEW_NAME}|g" "$WORK/deploy/supplier-stake.yaml" > /tmp/stake_new.yaml
diff "$WORK/deploy/supplier-stake.yaml" /tmp/stake_new.yaml || true
pocketd tx supplier stake-supplier --config /tmp/stake_new.yaml --services-only \
  --from wx-supplier --keyring-backend test --network=beta \
  --gas auto --gas-prices 1upokt --gas-adjustment 1.5 --yes > /tmp/switch_stake.txt 2>&1
grep -E '^(code|txhash)' /tmp/switch_stake.txt | head -2
echo "  NOTE: verify DELIVERY by querying the txhash. code 0 from --broadcast-mode"
echo "  sync is mempool admission only, not delivery."

echo
echo "=== 6. re-publish the card with the new spec URL ==="
sed "s|${OLD_NAME}|${NEW_NAME}|g" "$WORK/card.min.json" > /tmp/card_new.min.json
python3 - <<'PY'
import json
a = json.load(open('/home/ubuntu/pocket-hackathon/wx-ensemble/card.min.json'))
b = json.load(open('/tmp/card_new.min.json'))
assert a['specs'][0]['url'] != b['specs'][0]['url'], 'spec url did not change'
print('  old spec url:', a['specs'][0]['url'])
print('  new spec url:', b['specs'][0]['url'])
PY
pocketd tx service add-service "wx-ensemble" "Ensemble Weather Forecast With Multi-Model Spread" 50000 \
  --card-file /tmp/card_new.min.json \
  --from pocket-hack --keyring-backend test --network=beta \
  --gas auto --gas-prices 1upokt --gas-adjustment 1.5 --yes > /tmp/switch_card.txt 2>&1
grep -E '^(code|txhash)' /tmp/switch_card.txt | head -2

echo
echo "=== 7. final verification against the NEW hostname ==="
sleep 30
python3 - <<'PY'
import json, re, subprocess, hashlib
card = json.load(open('/tmp/card_new.min.json'))
base = 'https://' + card['specs'][0]['url'].split('/')[2]
ok = True
for h in card['serving']['healthcheck']:
    url = base + h['request']['path']
    r = subprocess.run(['curl','-s','--max-time','90','-w','\n%{http_code}',url],
                       capture_output=True, text=True, timeout=120)
    body,_,code = r.stdout.rpartition('\n')
    exp = h['expect']
    try: obj = json.loads(body)
    except Exception: obj = None
    cur = obj
    if obj is not None:
        for part in exp['json_path'].lstrip('$').split('.'):
            if part: cur = cur.get(part) if isinstance(cur,dict) else None
    passed = code=='200' and cur is not None and bool(re.fullmatch(exp['matches'], str(cur)))
    ok = ok and passed
    print('  %-5s %s  (expect %s got %r)' % ('PASS' if passed else 'FAIL', url, exp['matches'], cur))
r = subprocess.run(['curl','-s','--max-time','30',card['specs'][0]['url']], capture_output=True, timeout=60)
sha = hashlib.sha256(r.stdout).hexdigest()
match = sha == card['specs'][0]['sha256']
ok = ok and match
print('  %-5s spec hash matches what is served' % ('PASS' if match else 'FAIL'))
print()
print('RESULT:', 'SWITCH COMPLETE' if ok else 'SWITCH INCOMPLETE, CHECK ABOVE')
PY

echo
echo "=== 8. update the repo to reference the new hostname ==="
grep -rl "$OLD_NAME" "$WORK" --include='*.md' --include='*.json' --include='*.yaml' 2>/dev/null | while read -r f; do
  sed -i "s|${OLD_NAME}|${NEW_NAME}|g" "$f"
  echo "  updated $f"
done
cp /tmp/card_new.min.json "$WORK/card.min.json"
echo "  done. Commit and push when satisfied."
