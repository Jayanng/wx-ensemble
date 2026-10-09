#!/usr/bin/env bash
# Start and stop the one-time DuckDNS credential capture page.
#
#   sudo bash duckdns-capture.sh start      -> prints a one-time HTTPS URL
#   sudo bash duckdns-capture.sh cleanup    -> remove the route and the listener
#
# DESIGN
#   The route is a 128 bit random path on the existing HTTPS hostname, so it is
#   unguessable and needs no new certificate and no new open port. nginx proxies
#   just that one path to a loopback listener that is single use and time
#   limited. access_log is off for the location so nothing lands in a log.
#
#   Everything is removed afterwards whether or not a value arrived, so this
#   leaves no permanent hole in a hardened box.
set -uo pipefail

ACTION="${1:-}"
CONF="/etc/nginx/sites-available/wx-ensemble"
STATE="/home/ubuntu/.duckdns-capture.state"
PROC_NAME="duckdns-capture"

if [ "$ACTION" = "start" ]; then
  if [ -f "$STATE" ]; then
    echo "Capture is already running. Clean it up first:"
    echo "  sudo bash $0 cleanup"
    exit 1
  fi

  PATH_TOKEN=$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')
  PORT=8899

  echo "=== adding a temporary route (single path, logging off) ==="
  sudo cp "$CONF" "$CONF.bak-capture"

  sudo python3 - "$CONF" "$PATH_TOKEN" "$PORT" <<'PY'
import sys
conf, token, port = sys.argv[1], sys.argv[2], sys.argv[3]
src = open(conf).read()
block = f"""
    # TEMPORARY one-time credential capture. Removed by duckdns-capture.sh cleanup.
    location = /{token} {{
        access_log off;
        proxy_pass http://127.0.0.1:{port};
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_pass_request_body on;
        client_max_body_size 4k;
    }}
"""
marker = "    # --- everything else is signed relay traffic -----------------------------"
if marker not in src:
    raise SystemExit("anchor not found in nginx config; nothing changed")
open(conf, "w").write(src.replace(marker, block + "\n" + marker, 1))
print("  inserted")
PY

  sudo nginx -t 2>&1 | tail -2
  sudo systemctl reload nginx

  echo "=== starting the single-use listener ==="
  rm -f /home/ubuntu/.duckdns-staging.env
  CAPTURE_PORT="$PORT" \
  CAPTURE_TOKEN="$PATH_TOKEN" \
  CAPTURE_OUT="/home/ubuntu/.duckdns-staging.env" \
  CAPTURE_TTL_MS=600000 \
    node /home/ubuntu/pocket-hackathon/wx-ensemble/deploy/duckdns-capture.js \
    > /tmp/duckdns-capture.log 2>&1 &
  CAP_PID=$!
  echo "$CAP_PID $PATH_TOKEN" > "$STATE"
  sleep 2

  if kill -0 "$CAP_PID" 2>/dev/null; then
    echo
    echo "================================================================"
    echo "  OPEN THIS LINK ON YOUR PHONE AND PASTE THE TOKEN THERE:"
    echo
    echo "     https://wx-ensemble.duckdns.org/${PATH_TOKEN}"
    echo
    echo "  It closes itself after one submission, or after 10 minutes."
    echo "  Do not send the token here in chat."
    echo "================================================================"
    echo
    echo "When the page says Saved, run:"
    echo "  sudo bash $0 cleanup"
  else
    echo "  listener failed to start:"
    cat /tmp/duckdns-capture.log | head -5
    sudo cp "$CONF.bak-capture" "$CONF"
    sudo nginx -t >/dev/null 2>&1 && sudo systemctl reload nginx
    rm -f "$STATE"
    exit 1
  fi

elif [ "$ACTION" = "cleanup" ]; then
  echo "=== stopping the listener ==="
  if [ -f "$STATE" ]; then
    PID=$(awk '{print $1}' "$STATE")
    kill "$PID" 2>/dev/null && echo "  stopped pid $PID" || echo "  listener already gone"
    rm -f "$STATE"
  else
    echo "  no running capture recorded"
  fi

  echo "=== removing the temporary route ==="
  if [ -f "$CONF.bak-capture" ]; then
    sudo cp "$CONF.bak-capture" "$CONF"
    rm -f "$CONF.bak-capture"
    sudo nginx -t 2>&1 | tail -1
    sudo systemctl reload nginx
    echo "  route removed and nginx reloaded"
  else
    echo "  no backup found, config untouched"
  fi

  echo "=== the captured value ==="
  if [ -f /home/ubuntu/.duckdns-staging.env ]; then
    echo "  present at /home/ubuntu/.duckdns-staging.env (value not shown)"
  else
    echo "  not captured yet"
  fi

else
  echo "usage: sudo bash $0 {start|cleanup}"
  exit 1
fi
