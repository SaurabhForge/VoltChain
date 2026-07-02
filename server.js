import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// ============================================================
// GLOBAL CRASH GUARDS  (P0 — F4)
// ============================================================
process.on('uncaughtException', (err) => {
  console.error(JSON.stringify({ level: 'FATAL', ts: new Date().toISOString(), msg: 'uncaughtException', error: err.message, stack: err.stack }));
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error(JSON.stringify({ level: 'FATAL', ts: new Date().toISOString(), msg: 'unhandledRejection', reason: String(reason) }));
});

// ============================================================
// STRUCTURED LOGGER
// ============================================================
const log = {
  info:  (msg, meta = {}) => console.log(JSON.stringify({ level: 'INFO',  ts: new Date().toISOString(), msg, ...meta })),
  warn:  (msg, meta = {}) => console.warn(JSON.stringify({ level: 'WARN',  ts: new Date().toISOString(), msg, ...meta })),
  error: (msg, meta = {}) => console.error(JSON.stringify({ level: 'ERROR', ts: new Date().toISOString(), msg, ...meta })),
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.join(__dirname, 'frontend');

const app = express();
const PORT = process.env.PORT || 3000;
const allowedOrigins = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// ============================================================
// CORS MIDDLEWARE
// ============================================================
app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;
  if (allowedOrigins.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Body parser with size cap  (P0 — F5)
app.use(express.json({ limit: '16kb' }));
app.use(express.static(frontendDir));

// ============================================================
// HEALTH CHECK — enriched  (P0 — F3)
// ============================================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime_s: Math.round(process.uptime()),
    memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// SEED STATE  — globals are source-of-truth only; SSE clones them
// ============================================================
let fleetStats = {
  activeVehicles: 847,
  avgSoh: 94.2,
  co2Saved: 12.4,
  alerts: 2,
};

let batteryTelemetry = {
  cathodeTemp: 42.4,
  cycleCount: 1402,
  capacityRetention: 98.2,
  internalResistance: 0.024,
  thermalEfficiency: 91.7,
  predictedRul: 4.8,
};

const chatResponses = [
  'Optimal route via Sector-7 calculated. Carbon efficiency projected to increase by +12.4%.',
  'Warning: High thermal stress detected on Fleet Route Alpha. Re-routing cargo units to avoid degradation.',
  'Battery health anomalies detected in Cell Grid 4. Recommending a cell equalization cycle during next charge.',
  'Logistics sync complete. Inter-modal transition latencies reduced by 14% across all mapped nodes.',
  'System health nominal. Carbon offsets are matching projected targets for Q2 2026.',
];

// ============================================================
// REST APIs
// ============================================================
app.get('/api/fleet/stats', (req, res) => {
  res.json(fleetStats);
});

app.get('/api/battery/telemetry', (req, res) => {
  res.json(batteryTelemetry);
});

// Chat — with input validation  (P0 — F5)
app.post('/api/analyst/chat', (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'message is required' });
  }
  if (message.length > 500) {
    return res.status(400).json({ error: 'message too long (max 500 chars)' });
  }

  const msgLower = message.toLowerCase();
  log.info('CHAT_QUERY', { preview: message.slice(0, 60) });

  let reply = '';
  if (msgLower.includes('route') || msgLower.includes('path')) {
    reply = 'Re-routing algorithm initialized. Live traffic and weather patterns factored into current fleet paths.';
  } else if (msgLower.includes('battery') || msgLower.includes('soh') || msgLower.includes('temp')) {
    reply = `Current average SOH stands at ${fleetStats.avgSoh}%. No critical thermal threshold overruns reported in the past 2 hours.`;
  } else if (msgLower.includes('carbon') || msgLower.includes('co2') || msgLower.includes('emission')) {
    reply = `Total carbon savings for today: ${fleetStats.co2Saved.toFixed(2)} tons. Scope 3 optimization is tracking 4% ahead of schedule.`;
  } else if (msgLower.includes('alert') || msgLower.includes('anomaly')) {
    reply = `${fleetStats.alerts} active alert(s): Sector-7 thermal spike, Route-Alpha delay. Auto-mitigation protocols engaged.`;
  } else if (msgLower.includes('supply') || msgLower.includes('cobalt') || msgLower.includes('lithium') || msgLower.includes('chain')) {
    reply = 'Supply chain nominal. Kokkola Refinery at 98% compliance. DRC cobalt node flagged for ESG audit.';
  } else if (msgLower.includes('maintenance') || msgLower.includes('service') || msgLower.includes('charge')) {
    reply = 'Next maintenance: V-9102 Cell Equalization at 10:30 AM, Sector 7 Depot. V-4412 Thermal Check in progress.';
  } else {
    reply = chatResponses[Math.floor(Math.random() * chatResponses.length)];
  }

  log.info('CHAT_REPLY', { type: reply.slice(0, 30) });
  res.json({ reply });
});

// ============================================================
// SSE TELEMETRY STREAM — per-connection isolated state  (P0 — F2, F7)
// ============================================================
app.get('/api/telemetry/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  req.socket.setTimeout(0); // Disable socket timeout for SSE

  const connectedAt = Date.now();
  log.info('SSE_CONNECT', { ip: req.ip });

  // Clone global state — each client gets its own independent stream (F2)
  let local = {
    activeVehicles: fleetStats.activeVehicles,
    avgSoh: fleetStats.avgSoh,
    co2Saved: fleetStats.co2Saved,
    alerts: fleetStats.alerts,
    cathodeTemp: batteryTelemetry.cathodeTemp,
    cycleCount: batteryTelemetry.cycleCount,
    capacityRetention: batteryTelemetry.capacityRetention,
    internalResistance: batteryTelemetry.internalResistance,
  };

  // Safe write — never throws  (P0 — F7)
  const sendEvent = (data) => {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      log.warn('SSE_WRITE_FAIL', { msg: err.message });
      clearInterval(intervalId);
    }
  };

  // Send initial snapshot immediately
  sendEvent({
    fleetStats: {
      activeVehicles: local.activeVehicles,
      avgSoh: local.avgSoh,
      co2Saved: local.co2Saved,
      alerts: local.alerts,
    },
    batteryTelemetry: {
      cathodeTemp: local.cathodeTemp,
      cycleCount: local.cycleCount,
      capacityRetention: local.capacityRetention,
      internalResistance: local.internalResistance,
    },
    timestamp: new Date(),
  });

  const intervalId = setInterval(() => {
    // Random-walk mutations on local copy only — no global mutation
    local.activeVehicles = Math.max(0, local.activeVehicles + Math.floor(Math.random() * 3) - 1);
    local.co2Saved       = Number((local.co2Saved + Math.random() * 0.05).toFixed(3));
    local.cathodeTemp    = Number((42.4 + (Math.random() - 0.5) * 1.5).toFixed(1));
    local.internalResistance = Number((0.024 + (Math.random() - 0.5) * 0.002).toFixed(4));
    if (Math.random() > 0.85) local.alerts = Math.floor(Math.random() * 4);

    sendEvent({
      fleetStats: {
        activeVehicles: local.activeVehicles,
        avgSoh: local.avgSoh,
        co2Saved: local.co2Saved,
        alerts: local.alerts,
      },
      batteryTelemetry: {
        cathodeTemp: local.cathodeTemp,
        cycleCount: local.cycleCount,
        capacityRetention: local.capacityRetention,
        internalResistance: local.internalResistance,
      },
      timestamp: new Date(),
    });
  }, 2000);

  req.on('close', () => {
    clearInterval(intervalId);
    res.end();
    log.info('SSE_DISCONNECT', { durationMs: Date.now() - connectedAt });
  });
});

// ============================================================
// TIMELINE SNAPSHOTS — Temporal Time Capsule backend  (P1)
// ============================================================
const timelineSnapshots = {
  'Q1-2024': {
    activeVehicles: 621, avgSoh: 96.1, co2Saved: 8.2, alerts: 0,
    events: [
      { date: '15.03.24', highlight: false, text: 'Record battery performance week. Avg SOH peaked at 96.8%.' },
      { date: '08.03.24', highlight: false, text: 'New Kokkola Refinery supply contract signed. Cobalt risk reduced.' },
      { date: '01.03.24', highlight: false, text: 'Fleet expansion Phase-1 complete. 621 vehicles operational.' },
    ],
  },
  'Q2-2024': {
    activeVehicles: 710, avgSoh: 95.4, co2Saved: 9.8, alerts: 1,
    events: [
      { date: '22.06.24', highlight: true,  text: 'Thermal anomaly in Shipment #XA-12 flagged. Route diverted.' },
      { date: '10.06.24', highlight: false, text: 'Fleet expansion: +89 vehicles deployed across Corridor B.' },
      { date: '02.06.24', highlight: false, text: 'Carbon offset milestone: 50t CO₂ saved in Q2.' },
    ],
  },
  'Q3-2024': {
    activeVehicles: 788, avgSoh: 94.8, co2Saved: 11.1, alerts: 2,
    events: [
      { date: '18.09.24', highlight: true,  text: 'DRC cobalt compliance audit triggered. Node risk elevated to High.' },
      { date: '05.09.24', highlight: false, text: 'Carbon milestone: 100t CO₂ saved this week. New record.' },
      { date: '01.09.24', highlight: false, text: 'Gigafactory Berlin integration complete. Rail logistics active.' },
    ],
  },
  'TODAY': {
    activeVehicles: 847, avgSoh: 94.2, co2Saved: 12.4, alerts: 2,
    events: [
      { date: '04.12.24', highlight: true,  text: 'Anomaly detected in Lithium shipment #XA-92. AI flagged thermal stress variance.' },
      { date: '03.12.24', highlight: false, text: 'System nominal. Logistics at 98% efficiency. All fleets on schedule.' },
      { date: '01.12.24', highlight: false, text: 'Carbon milestone: 100t CO₂ saved this week. New record achieved.' },
    ],
  },
  'PREDICTIVE': {
    activeVehicles: 920, avgSoh: 93.1, co2Saved: 15.8, alerts: 0,
    events: [
      { date: 'Q1 2025', highlight: false, text: 'AI forecast: SOH degradation stable. 920 vehicles projected active.' },
      { date: 'Q2 2025', highlight: false, text: 'Predicted carbon savings: 15.8t/day. 40% scope 3 reduction on track.' },
      { date: 'Q3 2025', highlight: true,  text: 'High-confidence anomaly window: DRC supply chain. Preemptive audit recommended.' },
    ],
  },
};

app.get('/api/timeline/snapshot', (req, res) => {
  const { period = 'TODAY' } = req.query;
  const snap = timelineSnapshots[period];
  if (!snap) return res.status(404).json({ error: `Unknown period: ${period}` });
  res.json(snap);
});

// ============================================================
// QMS QUALITY TELEMETRY
// ============================================================
app.get('/api/qms/quality', (req, res) => {
  const points = [];
  const ucl = 0.027;
  const lcl = 0.021;
  const target = 0.024;
  for (let i = 1; i <= 20; i++) {
    let val = target + (Math.random() - 0.5) * 0.004;
    if (i === 17) val = 0.0285; // Deterministic anomaly — always present
    points.push({ sample: i, value: Number(val.toFixed(4)), defect: val > ucl || val < lcl });
  }
  res.json({ measureName: 'Separator Thickness Control (SPC)', ucl, lcl, target, points });
});

// ============================================================
// SUPPLY CHAIN NODES
// ============================================================
app.get('/api/supply-chain/nodes', (req, res) => {
  res.json({
    nodes: [
      { id: 'mine-chile-li', label: 'Salar de Atacama (Li)', type: 'Lithium Mine',       location: 'Chile',   risk: 'Medium', compliance: '94%' },
      { id: 'mine-drc-co',   label: 'Kolwezi Shinkolobwe (Co)', type: 'Cobalt Mine',     location: 'DRC',     risk: 'High',   compliance: '78%' },
      { id: 'ref-china-li',  label: 'Yibin Refinery',          type: 'Refining',         location: 'China',   risk: 'Medium', compliance: '88%' },
      { id: 'ref-finland-co',label: 'Kokkola Refinery',        type: 'Refining',         location: 'Finland', risk: 'Low',    compliance: '98%' },
      { id: 'giga-berlin',   label: 'Gigafactory Europe',      type: 'Cell & Pack Assembly', location: 'Germany', risk: 'Low', compliance: '99%' },
      { id: 'giga-texas',    label: 'Gigafactory Texas',       type: 'Cell & Pack Assembly', location: 'USA',     risk: 'Low', compliance: '99%' },
    ],
    edges: [
      { source: 'mine-chile-li',  target: 'ref-china-li',   label: 'Ocean Cargo (Crude Li)' },
      { source: 'mine-drc-co',    target: 'ref-finland-co', label: 'Air/Ocean Cargo (Crude Co)' },
      { source: 'ref-china-li',   target: 'giga-texas',     label: 'Ocean Cargo (Battery Grade Li)' },
      { source: 'ref-finland-co', target: 'giga-berlin',    label: 'Rail Cargo (Refined Co)' },
    ],
  });
});

// ============================================================
// MAINTENANCE SCHEDULE
// ============================================================
app.get('/api/maintenance/schedule', (req, res) => {
  res.json({
    chargingStations: [
      { id: 'CS-01', name: 'Corridor Alpha Hub',   status: 'Active',      type: 'DC Fast Charger', uptime: '98.8%' },
      { id: 'CS-02', name: 'Metro Terminal West',  status: 'Maintenance', type: 'AC Level 2',      uptime: '84.2%' },
      { id: 'CS-03', name: 'Sector 7 Depot',       status: 'Active',      type: 'DC Fast Charger', uptime: '99.4%' },
    ],
    schedule: [
      { vehicleId: 'V-9102', serviceType: 'Cell Equalization',      depot: 'Sector 7 Depot',     time: '10:30 AM', status: 'Scheduled'          },
      { vehicleId: 'V-4412', serviceType: 'Thermal Management Check', depot: 'Corridor Alpha Hub', time: '01:15 PM', status: 'In Progress'       },
      { vehicleId: 'V-8821', serviceType: 'BMS Calibration',          depot: 'Metro Terminal West', time: '04:30 PM', status: 'Pending CS-02 Uptime' },
    ],
  });
});

// ============================================================
// SPA FALLBACK
// ============================================================
app.use((req, res, next) => {
  if (req.method === 'GET' && (!req.path.includes('.') || req.path.endsWith('.html'))) {
    res.sendFile(path.join(frontendDir, 'index.html'));
  } else {
    next();
  }
});

// ============================================================
// EXPRESS 5 ERROR HANDLER — catches synchronous route errors
// ============================================================
app.use((err, req, res, _next) => {
  log.error('EXPRESS_ERROR', { msg: err.message, path: req.path });
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================================
// BOOT — guard for test environments
// ============================================================
export default app; // Exported for integration tests (P1)

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    log.info('SERVER_START', { port: PORT, env: process.env.NODE_ENV || 'development' });
  });
}
