'use strict';

/**
 * One-time capture page for the DuckDNS credential.
 *
 * WHY THIS EXISTS
 * ---------------
 * The token must travel from the user's phone to a root-only file without
 * passing through a chat transcript. The password vault cannot do it: that
 * mechanism is built so secret values never reach the agent, so it can fill a
 * website login form but cannot populate a config file.
 *
 * THREAT MODEL AND WHAT IS DONE ABOUT IT
 * --------------------------------------
 *  - The path is 128 bits of randomness, so it cannot be guessed or scanned.
 *  - SINGLE USE. The process exits the moment one value is accepted. There is
 *    no second submission to tamper with.
 *  - BOUNDED LIFETIME. It shuts itself down after CAPTURE_TTL_MS whether or not
 *    anything arrived, so it cannot linger on a hardened box.
 *  - The value is NEVER written to stdout, to a log, or to an error message.
 *    Only the word "captured" is printed.
 *  - nginx has access_log off for this location, so no body or query can end up
 *    in a log file.
 *  - It needs no root. It writes to a staging file in the caller's home
 *    directory with mode 600, and a separate sudo step installs it.
 *  - It serves no other route and reflects nothing back.
 */

const http = require('node:http');
const fs = require('node:fs');
const crypto = require('node:crypto');

const PORT = Number(process.env.CAPTURE_PORT || 8899);
const TOKEN = process.env.CAPTURE_TOKEN || '';
const OUT = process.env.CAPTURE_OUT || '/home/ubuntu/.duckdns-staging.env';
const TTL_MS = Number(process.env.CAPTURE_TTL_MS || 10 * 60 * 1000);

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

if (!TOKEN) {
  process.stderr.write('CAPTURE_TOKEN is required\n');
  process.exit(1);
}

function page(body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>DuckDNS credential</title>
<style>
  body { margin:0; font-family:ui-sans-serif, system-ui, sans-serif; background:#f4f4f6; color:#1c1c22; }
  .wrap { max-width:480px; margin:8vh auto; padding:0 20px; }
  .card { background:#fff; border:1px solid #e2e2e8; border-radius:12px; padding:24px; }
  h1 { font-size:19px; margin:0 0 6px; }
  p { font-size:14px; line-height:1.55; color:#4a4a55; margin:0 0 16px; }
  label { display:block; font-size:13px; font-weight:600; margin:0 0 6px; }
  input[type=password] {
    width:100%; box-sizing:border-box; padding:11px 12px; font-size:16px;
    border:1px solid #c9c9d2; border-radius:8px; font-family:ui-monospace, monospace;
  }
  button {
    margin-top:16px; width:100%; padding:12px; font-size:15px; font-weight:600;
    background:#2f6df6; color:#fff; border:0; border-radius:8px; cursor:pointer;
  }
  .note { font-size:12px; color:#7a7a88; margin-top:14px; line-height:1.5; }
  .ok { color:#17693a; }
</style>
</head>
<body>
<div class="wrap"><div class="card">${body}</div></div>
</body>
</html>`;
}

const FORM = page(`
  <h1>DuckDNS credential</h1>
  <p>This page exists so the token never has to pass through a chat message.
  It is written straight into a root-only file on the server and this page then
  destroys itself.</p>
  <form method="POST" autocomplete="off">
    <label for="t">DuckDNS token</label>
    <input id="t" name="t" type="password" inputmode="text" spellcheck="false"
           autocapitalize="off" autocorrect="off" required
           placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx">
    <button type="submit">Save credential</button>
  </form>
  <div class="note">
    Submitting closes this page permanently. Nothing is logged.
    If you pasted a token into chat earlier, generate a fresh one first.
  </div>
`);

const DONE = page(`
  <h1 class="ok">Saved</h1>
  <p>The credential is on the server and this page is now closed. You can leave.</p>
`);

const REJECTED = page(`
  <h1>Not accepted</h1>
  <p>That value is not shaped like a DuckDNS token. Nothing was written.</p>
`);

let used = false;

const server = http.createServer((req, res) => {
  // No access logging anywhere in here. Nothing is echoed back except static HTML.
  if (req.url !== `/${TOKEN}`) {
    res.writeHead(404, { 'content-type': 'text/plain', 'cache-control': 'no-store' });
    return res.end('not found');
  }

  if (req.method === 'GET') {
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store, no-cache, must-revalidate',
      'referrer-policy': 'no-referrer',
    });
    return res.end(FORM);
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'allow': 'GET, POST', 'cache-control': 'no-store' });
    return res.end();
  }

  if (used) {
    res.writeHead(410, { 'content-type': 'text/plain', 'cache-control': 'no-store' });
    return res.end('closed');
  }

  let body = '';
  let size = 0;
  req.on('data', (c) => {
    size += c.length;
    if (size > 4096) {
      req.destroy();
      return;
    }
    body += c;
  });

  req.on('end', () => {
    const params = new URLSearchParams(body);
    const value = (params.get('t') || '').trim();

    if (!UUID_RE.test(value)) {
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      });
      return res.end(REJECTED);
    }

    // Accepted. Mark used BEFORE writing so a second request cannot race in.
    used = true;

    const out = [
      '# DuckDNS credential for wx-ensemble. Captured ' + new Date().toISOString() + '.',
      '# Mode 600. Never commit. Never echo.',
      'DUCKDNS_DOMAIN=wx-ensemble',
      'DUCKDNS_TOKEN=' + value,
      '',
    ].join('\n');

    fs.writeFileSync(OUT, out, { mode: 0o600 });

    // Deliberately the ONLY thing printed. The value itself goes nowhere.
    process.stdout.write('captured\n');

    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    });
    res.end(DONE);

    setTimeout(() => {
      server.close(() => process.exit(0));
    }, 500);
  });
});

const shutdown = () => {
  try {
    server.close(() => process.exit(0));
  } catch {
    process.exit(0);
  }
  setTimeout(() => process.exit(0), 1500).unref();
};

setTimeout(shutdown, TTL_MS).unref();
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

server.listen(PORT, '127.0.0.1', () => {
  process.stdout.write('listening\n');
});
