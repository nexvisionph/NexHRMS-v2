#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Simple FKWeb -> HRMS bridge
// Listens on port 5006 and forwards scanner JSON payloads to local Next.js API

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const os = require('os');

try {
  require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
  require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local'), override: true });
} catch {
  // dotenv is optional for packaged/runtime deployments where env vars are injected.
}

const LISTEN_PORT = process.env.PORT
  ? Number(process.env.PORT)
  : process.env.FK_BRIDGE_PORT
  ? Number(process.env.FK_BRIDGE_PORT)
  : 8080;
const TARGET = process.env.T800_BRIDGE_TARGET_URL || process.env.HRMS_URL || 'http://localhost:3000/api/attendance/t800';
const KIOSK_API_KEY = process.env.KIOSK_API_KEY || '';
const LOG_FILE = process.env.FK_BRIDGE_LOG_FILE || path.resolve(process.cwd(), 'scripts', 'fk-bridge.log');

function log(level, message, data) {
  const line = `[${new Date().toISOString()}] [${level}] ${message}${data === undefined ? '' : ` ${JSON.stringify(data)}`}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, `${line}\n`);
  } catch {
    // Diagnostic logging only.
  }
}

function extractJsonFromBuffer(buf) {
  try {
    const s = buf.toString('utf8');
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      const part = s.slice(start, end + 1);
      return JSON.parse(part);
    }
  } catch {
    // ignore
  }
  return null;
}

function parseBody(buf, contentType) {
  const text = buf.toString('utf8');

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch {
      return extractJsonFromBuffer(buf);
    }
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const form = new URLSearchParams(text);
    return Object.fromEntries(form.entries());
  }

  return extractJsonFromBuffer(buf);
}

function decodeBlockJson(parsed) {
  if (!parsed || typeof parsed.block !== 'string') return null;

  try {
    const blockBuf = Buffer.from(parsed.block, 'base64');
    return extractJsonFromBuffer(blockBuf);
  } catch {
    return null;
  }
}

function firstValue(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return null;
}

function normalizeRequestCode(value) {
  return String(value || '').trim().toLowerCase();
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const remote = `${req.socket.remoteAddress || 'unknown'}:${req.socket.remotePort || ''}`;

  if (req.method === 'GET' && url.pathname === '/health') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({
      ok: true,
      bridge: 'fk-bridge',
      listeningPort: LISTEN_PORT,
      target: TARGET,
      logFile: LOG_FILE,
    }));
    return;
  }

  if (req.method !== 'POST') {
    log('info', 'non-post request received', {
      method: req.method,
      path: url.pathname,
      remote,
      requestCode: req.headers['request_code'],
      devId: req.headers['dev_id'],
      blkNo: req.headers['blk_no'],
    });
    res.statusCode = 200;
    res.end('OK');
    return;
  }

  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', async () => {
    const buf = Buffer.concat(chunks);
    const ctype = String(req.headers['content-type'] || '').toLowerCase();
    log('info', 'post request received', {
      path: url.pathname,
      remote,
      requestCode: req.headers['request_code'],
      devId: req.headers['dev_id'],
      blkNo: req.headers['blk_no'],
      contentType: ctype,
      bytes: buf.length,
    });
    let parsed = parseBody(buf, ctype);

    if (!parsed) {
      log('info', 'accepted non-log/partial request', {
        requestCode: req.headers['request_code'],
        devId: req.headers['dev_id'],
        blkNo: req.headers['blk_no'],
        bytes: buf.length,
      });
      res.setHeader('response_code', 'OK');
      res.statusCode = 200;
      res.end('OK');
      return;
    }

    const blockJson = decodeBlockJson(parsed);
    if (blockJson) {
      parsed = { ...parsed, ...blockJson };
    }

    const requestCode = normalizeRequestCode(parsed.request_code || req.headers['request_code']);
    const biometricId = firstValue(
      parsed.biometricId,
      parsed.user_id,
      parsed.userId,
      parsed.enroll_id,
      parsed.enrollId,
      parsed.pin,
      parsed.user,
      parsed.uid,
      parsed.id
    );

    // Supabase config (for storing/fetching templates)
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    // Handle enrollment sync / user list fetch from devices
    if (requestCode === 'set_userinfo') {
      if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        log('warn', 'set_userinfo rejected (no supabase config)');
        res.setHeader('response_code', 'ERROR_NO_SUPABASE');
        res.statusCode = 500;
        res.end('ERROR');
        return;
      }

      try {
        const body = {
          biometric_id: biometricId,
          name: firstValue(parsed.name, parsed.user, parsed.fullname) || null,
          finger_template: parsed.finger_template || parsed.fingerprint || parsed.fingerTemplate || null,
          face_template: parsed.face_template || parsed.face || parsed.faceTemplate || null,
          privilege: parsed.privilege ?? parsed.privilege_level ?? 0,
          employee_id: parsed.employee_id || null,
        };

        await fetch(`${SUPABASE_URL}/rest/v1/biometric_templates`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates',
          },
          body: JSON.stringify(body),
        });

        res.setHeader('response_code', 'OK');
        res.statusCode = 200;
        res.end('OK');
        return;
      } catch (err) {
        log('error', 'set_userinfo failed', { message: err?.message });
        res.setHeader('response_code', 'ERROR');
        res.statusCode = 500;
        res.end('ERROR');
        return;
      }
    }

    if (requestCode === 'get_all_userinfo') {
      if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        log('warn', 'get_all_userinfo rejected (no supabase config)');
        res.setHeader('response_code', 'ERROR_NO_SUPABASE');
        res.statusCode = 500;
        res.end('ERROR');
        return;
      }

      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/biometric_templates?select=id,biometric_id,name,privilege,face_template,finger_template,employee_id`, {
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
        });
        const users = await r.json();
        res.setHeader('response_code', 'OK');
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify(users));
        return;
      } catch (err) {
        log('error', 'get_all_userinfo failed', { message: err?.message });
        res.setHeader('response_code', 'ERROR');
        res.statusCode = 500;
        res.end('ERROR');
        return;
      }
    }

    const isRealtimeLog = requestCode === 'realtime_glog' || Boolean(biometricId);

    if (!isRealtimeLog) {
      log('info', 'accepted non-attendance request', { requestCode, keys: Object.keys(parsed) });
      res.setHeader('response_code', 'OK');
      res.statusCode = 200;
      res.end('OK');
      return;
    }

    // Normalize keys to T800/HRMS-friendly names
    const deviceId = firstValue(parsed.dev_id, parsed.device_id, parsed.deviceId, parsed.dev, req.headers['dev_id']);
    const io_time = firstValue(parsed.io_time, parsed.timestamp, parsed.scanTime, parsed.timestampUTC, parsed.time);
    const io_mode = firstValue(parsed.io_mode, parsed.mode);

    // Build payload matching the T800 adapter expectations so the server
    // recognizes `request_code` and `user_id` and processes the realtime log.
    const payload = {
      request_code: firstValue(parsed.request_code, req.headers['request_code']) || 'realtime_glog',
      user_id: biometricId,
      io_time,
      io_mode,
      dev_id: deviceId,
      deviceId,
      biometricId,
    };

    if (!payload.biometricId) {
      log('warn', 'realtime log missing biometric ID', {
        requestCode,
        devId: payload.deviceId,
        keys: Object.keys(parsed),
      });
    }

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (KIOSK_API_KEY) headers['x-kiosk-api-key'] = KIOSK_API_KEY;
      const fetchRes = await fetch(TARGET, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const text = await fetchRes.text();
      const responseCode = fetchRes.headers.get('response_code') || '';
      if (!fetchRes.ok || responseCode.startsWith('ERROR') || text.includes('ERROR')) {
        log('warn', 'forward rejected', { payload, status: fetchRes.status, responseCode, text });
      } else {
        log('info', 'forwarded', { payload, status: fetchRes.status, responseCode, text });
      }
    } catch (err) {
      log('error', 'forward error', { message: err?.message, stack: err?.stack });
    }

    // Respond in a simple text OK so device thinks server accepted
    res.setHeader('response_code', 'OK');
    res.setHeader('trans_id', 'BRIDGE');
    res.setHeader('cmd_code', 'REALTIME_GLOG');
    res.statusCode = 200;
    res.end('OK');
  });
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    log('error', `port ${LISTEN_PORT} is already in use`);
    log('error', 'Another bridge is already running. Close the old terminal/process, or use a different FK_BRIDGE_PORT and update the T800 ServerPort to match.');
    process.exit(1);
  }
  log('error', 'server error', { message: err?.message, stack: err?.stack });
  process.exit(1);
});

function listLocalAddresses() {
  const nets = os.networkInterfaces();
  const results = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) results.push(net.address);
    }
  }
  return results;
}

server.listen(LISTEN_PORT, '0.0.0.0', () => {
  const addrs = listLocalAddresses();
  log('info', 'bridge listening', { port: LISTEN_PORT, target: TARGET, logFile: LOG_FILE });
  if (addrs.length) log('info', 'local addresses', { addresses: addrs });
});

// allow running with node scripts/fk-bridge.js
