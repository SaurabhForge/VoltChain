import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

// Simulated in-memory database
let fleetStats = {
  activeVehicles: 847,
  avgSoh: 94.2,
  co2Saved: 12.4,
  alerts: 2
};

let batteryTelemetry = {
  cathodeTemp: 42.4,
  cycleCount: 1402,
  capacityRetention: 98.2,
  internalResistance: 0.024,
  thermalEfficiency: 91.7,
  predictedRul: 4.8
};

const chatResponses = [
  "Optimal route via Sector-7 calculated. Carbon efficiency is projected to increase by +12.4%.",
  "Warning: High thermal stress detected on Fleet Route Alpha. Re-routing cargo units to avoid degradation.",
  "Battery health anomalies detected in Cell Grid 4. Recommending a cell equalization cycle during next charge.",
  "Logistics sync complete. Inter-modal transition latencies reduced by 14% across all mapped nodes.",
  "System health nominal. Carbon offsets are matching projected targets for Q2 2026."
];

// REST APIs
app.get('/api/fleet/stats', (req, res) => {
  res.json(fleetStats);
});

app.get('/api/battery/telemetry', (req, res) => {
  res.json(batteryTelemetry);
});

app.post('/api/analyst/chat', (req, res) => {
  const { message } = req.body;
  console.log(`Received message from client: "${message}"`);
  
  // Basic context-aware replies
  let reply = "";
  const msgLower = (message || "").toLowerCase();
  if (msgLower.includes("route") || msgLower.includes("path")) {
    reply = "Re-routing algorithm initialized. Live traffic and weather patterns factored into current fleet paths.";
  } else if (msgLower.includes("battery") || msgLower.includes("soh") || msgLower.includes("temperature")) {
    reply = `Current average SOH stands at ${fleetStats.avgSoh}%. No critical thermal threshold overruns reported in the past 2 hours.`;
  } else if (msgLower.includes("carbon") || msgLower.includes("co2") || msgLower.includes("emission")) {
    reply = `Total carbon savings for today is ${fleetStats.co2Saved} tons. Scope 3 optimization is tracking 4% ahead of schedule.`;
  } else {
    // Return a random response from the curated list
    reply = chatResponses[Math.floor(Math.random() * chatResponses.length)];
  }

  res.json({ reply });
});

// SSE telemetry stream
app.get('/api/telemetry/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Send initial data immediately
  sendEvent({ fleetStats, batteryTelemetry, timestamp: new Date() });

  const intervalId = setInterval(() => {
    // Random walk fluctuations for live telemetry feel
    fleetStats.activeVehicles += Math.floor(Math.random() * 3) - 1;
    fleetStats.co2Saved += Number((Math.random() * 0.05).toFixed(3));
    
    batteryTelemetry.cathodeTemp = Number((42.4 + (Math.random() - 0.5) * 1.5).toFixed(1));
    batteryTelemetry.internalResistance = Number((0.024 + (Math.random() - 0.5) * 0.002).toFixed(4));
    
    if (Math.random() > 0.85) {
      fleetStats.alerts = Math.floor(Math.random() * 4);
    }

    sendEvent({ fleetStats, batteryTelemetry, timestamp: new Date() });
  }, 2000);

  req.on('close', () => {
    clearInterval(intervalId);
    res.end();
  });
});


// Mock QMS Quality Telemetry
app.get('/api/qms/quality', (req, res) => {
  const points = [];
  const ucl = 0.027; // Upper Control Limit in mm
  const lcl = 0.021; // Lower Control Limit in mm
  const target = 0.024;
  
  // Generate 20 data points representing separator thickness
  for (let i = 1; i <= 20; i++) {
    let val = target + (Math.random() - 0.5) * 0.004;
    // Add one anomaly point near the end
    if (i === 17) val = 0.0285; // Anomaly (defect)
    points.push({ sample: i, value: Number(val.toFixed(4)), defect: val > ucl || val < lcl });
  }
  res.json({
    measureName: "Separator Thickness Control (SPC)",
    ucl,
    lcl,
    target,
    points
  });
});

// Mock Supply Chain Map Telemetry
app.get('/api/supply-chain/nodes', (req, res) => {
  res.json({
    nodes: [
      { id: "mine-chile-li", label: "Salar de Atacama (Li)", type: "Lithium Mine", location: "Chile", risk: "Medium", compliance: "94%" },
      { id: "mine-drc-co", label: "Kolwezi Shinkolobwe (Co)", type: "Cobalt Mine", location: "DRC", risk: "High", compliance: "78%" },
      { id: "ref-china-li", label: "Yibin Refinery", type: "Refining", location: "China", risk: "Medium", compliance: "88%" },
      { id: "ref-finland-co", label: "Kokkola Refinery", type: "Refining", location: "Finland", risk: "Low", compliance: "98%" },
      { id: "giga-berlin", label: "Gigafactory Europe", type: "Cell & Pack Assembly", location: "Germany", risk: "Low", compliance: "99%" },
      { id: "giga-texas", label: "Gigafactory Texas", type: "Cell & Pack Assembly", location: "USA", risk: "Low", compliance: "99%" }
    ],
    edges: [
      { source: "mine-chile-li", target: "ref-china-li", label: "Ocean Cargo (Crude Li)" },
      { source: "mine-drc-co", target: "ref-finland-co", label: "Air/Ocean Cargo (Crude Co)" },
      { source: "ref-china-li", target: "giga-texas", label: "Ocean Cargo (Battery Grade Li)" },
      { source: "ref-finland-co", target: "giga-berlin", label: "Rail Cargo (Refined Co)" }
    ]
  });
});

// Mock Maintenance Telemetry
app.get('/api/maintenance/schedule', (req, res) => {
  res.json({
    chargingStations: [
      { id: "CS-01", name: "Corridor Alpha Hub", status: "Active", type: "DC Fast Charger", uptime: "98.8%" },
      { id: "CS-02", name: "Metro Terminal West", status: "Maintenance", type: "AC Level 2", uptime: "84.2%" },
      { id: "CS-03", name: "Sector 7 Depot", status: "Active", type: "DC Fast Charger", uptime: "99.4%" }
    ],
    schedule: [
      { vehicleId: "V-9102", serviceType: "Cell Equalization", depot: "Sector 7 Depot", time: "10:30 AM", status: "Scheduled" },
      { vehicleId: "V-4412", serviceType: "Thermal Management Check", depot: "Corridor Alpha Hub", time: "01:15 PM", status: "In Progress" },
      { vehicleId: "V-8821", serviceType: "BMS Calibration", depot: "Metro Terminal West", time: "04:30 PM", status: "Pending CS-02 Uptime" }
    ]
  });
});

// Fallback to serving index.html
app.use((req, res, next) => {
  if (req.method === 'GET' && (!req.path.includes('.') || req.path.endsWith('.html'))) {
    res.sendFile(path.join(__dirname, 'index.html'));
  } else {
    next();
  }
});

app.listen(PORT, () => {
  console.log(`VoltChain Backend is running at http://localhost:${PORT}`);
});
