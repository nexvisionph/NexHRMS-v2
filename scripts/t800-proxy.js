#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');

const LISTEN_PORT = process.env.T800_LISTEN_PORT ? Number(process.env.T800_LISTEN_PORT) : 5005;
const TARGET_HOST = process.env.TARGET_HOST || '127.0.0.1';
const TARGET_PORT = process.env.TARGET_PORT ? Number(process.env.TARGET_PORT) : 3000;
const TARGET_PATH = process.env.TARGET_PATH || '/api/attendance/t800';
const LOG_FILE = process.env.T800_LOG_FILE || path.join('C:\\tmp', `t800-proxy-${LISTEN_PORT}.log`);

function log(...args) {
  const message = args.map((arg) => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ');
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, line + os.EOL);
  } catch {
    // Console logging is enough if file logging is unavailable.
  }
}

function getLanAddresses() {

    
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((addr) => addr && addr.family === 'IPv4' && !addr.internal)
    .map((addr) => addr.address);
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      listenPort: LISTEN_PORT,
      target: `http://${TARGET_HOST}:${TARGET_PORT}${TARGET_PATH}`,
      logFile: LOG_FILE,
      lanUrls: getLanAddresses().map((ip) => `http://${ip}:${LISTEN_PORT}`),
    }));
    return;
  }

  log('[t800-proxy] incoming', req.method, req.url, {
    contentType: req.headers['content-type'],
    requestCode: req.headers.request_code,
    devId: req.headers.dev_id,
    encrypt: req.headers.encrypt,
    blkNo: req.headers.blk_no,
  });

  // Build options for forwarding the request to the Next.js app
  const options = {
    hostname: TARGET_HOST,
    port: TARGET_PORT,
    path: TARGET_PATH,
    method: req.method,
    headers: Object.assign({}, req.headers, { host: `${TARGET_HOST}:${TARGET_PORT}` }),
  };

  const proxyReq = http.request(options, (proxyRes) => {
    // Forward status and headers back to the original client
    log('[t800-proxy] proxied response', {
      statusCode: proxyRes.statusCode,
      contentType: proxyRes.headers['content-type'],
      responseCode: proxyRes.headers.response_code,
    });
    res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    log('[t800-proxy] proxy request error:', err.message);
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Bad Gateway');
  });

  // Pipe incoming request body to the proxied request
  req.pipe(proxyReq, { end: true });
});

server.on('clientError', (err, socket) => {
  const rawPacket = err.rawPacket ? err.rawPacket.subarray(0, 32) : null;
  log('[t800-proxy] client error', err.message, rawPacket ? {
    rawHex: rawPacket.toString('hex'),
    rawAscii: rawPacket.toString('ascii').replace(/[^\x20-\x7E]/g, '.'),
  } : {});
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.listen(LISTEN_PORT, () => {
  log(`[t800-proxy] Listening on 0.0.0.0:${LISTEN_PORT} -> http://${TARGET_HOST}:${TARGET_PORT}${TARGET_PATH}`);
  log(`[t800-proxy] Log file: ${LOG_FILE}`);
  const lanAddresses = getLanAddresses();
  if (lanAddresses.length) {
    log('[t800-proxy] Use one of these as the T800 server address:');
    lanAddresses.forEach((ip) => log(`  http://${ip}:${LISTEN_PORT}`));
    log(`[t800-proxy] Health check: http://${lanAddresses[0]}:${LISTEN_PORT}/health`);
  }
});

// Graceful shutdown
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
