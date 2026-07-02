/**
 * VoltChain SSE Load Test
 * ========================
 * Simulates N concurrent SSE clients for DURATION ms.
 * Run: node scripts/sse-load-test.js
 *
 * Environment vars:
 *   BASE_URL     — default: http://localhost:3000
 *   CONNECTIONS  — default: 50
 *   DURATION_MS  — default: 20000 (20 seconds)
 */

import http from 'http';
import https from 'https';

const BASE_URL    = process.env.BASE_URL    || 'http://localhost:3000';
const CONNECTIONS = parseInt(process.env.CONNECTIONS  || '50', 10);
const DURATION_MS = parseInt(process.env.DURATION_MS  || '20000', 10);

const url = new URL(BASE_URL + '/api/telemetry/stream');
const transport = url.protocol === 'https:' ? https : http;

console.log(`\n⚡ VoltChain SSE Load Test`);
console.log(`   Target     : ${url.href}`);
console.log(`   Connections: ${CONNECTIONS}`);
console.log(`   Duration   : ${DURATION_MS / 1000}s\n`);

let received = 0;
let errors   = 0;
let connects = 0;
const startMs = Date.now();

const clients = Array.from({ length: CONNECTIONS }, (_, i) =>
  new Promise((resolve) => {
    const req = transport.get(
      { hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80), path: url.pathname, headers: { Accept: 'text/event-stream' } },
      (res) => {
        if (res.statusCode !== 200) { errors++; resolve(); return; }
        connects++;
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          // Count each SSE event (ends with \n\n)
          const events = chunk.split('\n\n').filter((s) => s.trim().startsWith('data:'));
          received += events.length;
        });
        res.on('error', () => errors++);
      }
    );
    req.on('error', () => { errors++; resolve(); });
    setTimeout(() => { req.destroy(); resolve(); }, DURATION_MS);
  })
);

await Promise.all(clients);

const elapsedS = (Date.now() - startMs) / 1000;
const eventsPerSec = (received / elapsedS).toFixed(1);
const eventsPerClient = (received / Math.max(connects, 1)).toFixed(1);

console.log('─'.repeat(44));
console.log(`✅ Connections established : ${connects} / ${CONNECTIONS}`);
console.log(`📡 Total SSE events recv   : ${received}`);
console.log(`❌ Connection errors       : ${errors}`);
console.log(`⏱️  Elapsed                : ${elapsedS.toFixed(1)}s`);
console.log(`🚀 Events/sec              : ${eventsPerSec}`);
console.log(`📊 Events/client           : ${eventsPerClient}`);
console.log('─'.repeat(44));

if (errors > 0) {
  console.warn(`\n⚠️  ${errors} error(s) detected — check server logs.`);
  process.exit(1);
} else {
  console.log('\n✅ Load test passed — all connections handled cleanly.');
}
