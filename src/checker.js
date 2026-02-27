import { createConnection } from 'net';
import { connect as tlsConnect } from 'tls';

const COMMON_ENDPOINTS = ['/health', '/api/status', '/ping', '/status', '/healthz'];
const DEFAULT_TIMEOUT = 10000;

export async function checkEndpoint(url, { timeout = DEFAULT_TIMEOUT } = {}) {
  const parsed = new URL(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  const result = {
    url,
    timestamp: new Date().toISOString(),
    status: null,
    statusText: null,
    responseTime: null,
    responseSize: null,
    redirectChain: [],
    ssl: null,
    error: null,
    ok: false,
  };

  const start = Date.now();

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'api-heart/1.0.0' },
    });

    result.responseTime = Date.now() - start;
    result.status = response.status;
    result.statusText = response.statusText;
    result.ok = response.ok;

    const body = await response.text();
    result.responseSize = Buffer.byteLength(body, 'utf8');

    if (response.redirected) {
      result.redirectChain = [url, response.url];
    }
  } catch (err) {
    result.responseTime = Date.now() - start;
    result.error = err.name === 'AbortError' ? `Timeout after ${timeout}ms` : err.message;
  } finally {
    clearTimeout(timer);
  }

  if (parsed.protocol === 'https:') {
    result.ssl = await checkSSL(parsed.hostname, parseInt(parsed.port || 443, 10));
  }

  return result;
}

export async function probeCommonEndpoints(baseUrl) {
  const parsed = new URL(baseUrl);
  const base = `${parsed.protocol}//${parsed.host}`;
  const probes = [];

  for (const path of COMMON_ENDPOINTS) {
    const probeUrl = `${base}${path}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);

    try {
      const start = Date.now();
      const res = await fetch(probeUrl, {
        signal: ctrl.signal,
        headers: { 'User-Agent': 'api-heart/1.0.0' },
      });
      const ms = Date.now() - start;
      probes.push({ path, status: res.status, ms, found: res.ok });
    } catch {
      probes.push({ path, status: null, ms: null, found: false });
    } finally {
      clearTimeout(timer);
    }
  }

  return probes;
}

function checkSSL(host, port = 443) {
  return new Promise((resolve) => {
    const socket = tlsConnect({ host, port, servername: host, timeout: 5000 }, () => {
      try {
        const cert = socket.getPeerCertificate();
        if (!cert || !cert.valid_to) {
          socket.destroy();
          resolve({ valid: false, daysRemaining: null, expiresAt: null, error: 'No cert data' });
          return;
        }
        const expiresAt = new Date(cert.valid_to);
        const daysRemaining = Math.floor((expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
        socket.destroy();
        resolve({
          valid: socket.authorized !== false,
          daysRemaining,
          expiresAt: expiresAt.toISOString(),
          subject: cert.subject?.CN || host,
          issuer: cert.issuer?.O || null,
        });
      } catch (err) {
        socket.destroy();
        resolve({ valid: false, daysRemaining: null, expiresAt: null, error: err.message });
      }
    });

    socket.on('error', (err) => {
      resolve({ valid: false, daysRemaining: null, expiresAt: null, error: err.message });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ valid: false, daysRemaining: null, expiresAt: null, error: 'SSL timeout' });
    });
  });
}

export function gradeEndpoint(result) {
  if (result.error) return 'F';
  if (!result.ok) {
    if (result.status >= 500) return 'F';
    if (result.status >= 400) return 'D';
    return 'C';
  }
  const { responseTime, ssl } = result;
  if (ssl && ssl.daysRemaining !== null && ssl.daysRemaining < 7) return 'D';
  if (responseTime < 200) return 'A';
  if (responseTime < 500) return 'B';
  if (responseTime < 1500) return 'C';
  if (responseTime < 3000) return 'D';
  return 'F';
}
