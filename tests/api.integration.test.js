import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

// Integration tests require the server to export `app` without auto-listening.
// NODE_ENV=test prevents app.listen() from firing (see server.js export guard).
process.env.NODE_ENV = 'test';

let app;

beforeAll(async () => {
  const mod = await import('../server.js');
  app = mod.default;
});

afterAll(() => {
  // Nothing to close — no active listen() in test mode
});

// ============================================================
// /health
// ============================================================
describe('GET /health', () => {
  it('responds 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('includes uptime_s as a non-negative number', async () => {
    const res = await request(app).get('/health');
    expect(typeof res.body.uptime_s).toBe('number');
    expect(res.body.uptime_s).toBeGreaterThanOrEqual(0);
  });

  it('includes memory_mb as a positive number', async () => {
    const res = await request(app).get('/health');
    expect(res.body.memory_mb).toBeGreaterThan(0);
  });

  it('includes an ISO timestamp', async () => {
    const res = await request(app).get('/health');
    expect(new Date(res.body.timestamp).getTime()).not.toBeNaN();
  });
});

// ============================================================
// /api/fleet/stats
// ============================================================
describe('GET /api/fleet/stats', () => {
  it('returns 200 with all required fields', async () => {
    const res = await request(app).get('/api/fleet/stats');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('activeVehicles');
    expect(res.body).toHaveProperty('avgSoh');
    expect(res.body).toHaveProperty('co2Saved');
    expect(res.body).toHaveProperty('alerts');
  });

  it('activeVehicles is a positive integer', async () => {
    const res = await request(app).get('/api/fleet/stats');
    expect(Number.isInteger(res.body.activeVehicles)).toBe(true);
    expect(res.body.activeVehicles).toBeGreaterThan(0);
  });

  it('avgSoh is between 0 and 100', async () => {
    const res = await request(app).get('/api/fleet/stats');
    expect(res.body.avgSoh).toBeGreaterThan(0);
    expect(res.body.avgSoh).toBeLessThanOrEqual(100);
  });
});

// ============================================================
// /api/battery/telemetry
// ============================================================
describe('GET /api/battery/telemetry', () => {
  it('returns 200 with battery fields', async () => {
    const res = await request(app).get('/api/battery/telemetry');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('cathodeTemp');
    expect(res.body).toHaveProperty('cycleCount');
    expect(res.body).toHaveProperty('capacityRetention');
    expect(res.body).toHaveProperty('internalResistance');
  });

  it('cycleCount is a positive integer', async () => {
    const res = await request(app).get('/api/battery/telemetry');
    expect(res.body.cycleCount).toBeGreaterThan(0);
  });
});

// ============================================================
// /api/analyst/chat
// ============================================================
describe('POST /api/analyst/chat', () => {
  it('returns a reply string for a valid battery message', async () => {
    const res = await request(app)
      .post('/api/analyst/chat')
      .send({ message: 'battery status?' });
    expect(res.status).toBe(200);
    expect(typeof res.body.reply).toBe('string');
    expect(res.body.reply.length).toBeGreaterThan(0);
  });

  it('returns a route reply for route keyword', async () => {
    const res = await request(app)
      .post('/api/analyst/chat')
      .send({ message: 'optimize the route please' });
    expect(res.status).toBe(200);
    expect(res.body.reply.toLowerCase()).toMatch(/route|traffic|fleet/);
  });

  it('returns 400 for missing message', async () => {
    const res = await request(app)
      .post('/api/analyst/chat')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 for empty string message', async () => {
    const res = await request(app)
      .post('/api/analyst/chat')
      .send({ message: '   ' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for oversized message (501 chars)', async () => {
    const res = await request(app)
      .post('/api/analyst/chat')
      .send({ message: 'x'.repeat(501) });
    expect(res.status).toBe(400);
  });

  it('accepts message of exactly 500 chars', async () => {
    const res = await request(app)
      .post('/api/analyst/chat')
      .send({ message: 'x'.repeat(500) });
    expect(res.status).toBe(200);
  });
});

// ============================================================
// /api/qms/quality
// ============================================================
describe('GET /api/qms/quality', () => {
  it('returns 20 data points', async () => {
    const res = await request(app).get('/api/qms/quality');
    expect(res.status).toBe(200);
    expect(res.body.points).toHaveLength(20);
  });

  it('always marks sample 17 as a defect', async () => {
    const res = await request(app).get('/api/qms/quality');
    const s17 = res.body.points.find((p) => p.sample === 17);
    expect(s17).toBeDefined();
    expect(s17.defect).toBe(true);
    expect(s17.value).toBeGreaterThan(res.body.ucl);
  });

  it('includes ucl, lcl, and target', async () => {
    const res = await request(app).get('/api/qms/quality');
    expect(res.body.ucl).toBe(0.027);
    expect(res.body.lcl).toBe(0.021);
    expect(res.body.target).toBe(0.024);
  });
});

// ============================================================
// /api/supply-chain/nodes
// ============================================================
describe('GET /api/supply-chain/nodes', () => {
  it('returns nodes and edges arrays', async () => {
    const res = await request(app).get('/api/supply-chain/nodes');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.nodes)).toBe(true);
    expect(Array.isArray(res.body.edges)).toBe(true);
  });

  it('has at least 2 high-risk and low-risk nodes', async () => {
    const res = await request(app).get('/api/supply-chain/nodes');
    const high = res.body.nodes.filter((n) => n.risk === 'High');
    const low  = res.body.nodes.filter((n) => n.risk === 'Low');
    expect(high.length).toBeGreaterThanOrEqual(1);
    expect(low.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// /api/timeline/snapshot
// ============================================================
describe('GET /api/timeline/snapshot', () => {
  const periods = ['Q1-2024', 'Q2-2024', 'Q3-2024', 'TODAY', 'PREDICTIVE'];

  periods.forEach((period) => {
    it(`returns valid snapshot for period ${period}`, async () => {
      const res = await request(app).get('/api/timeline/snapshot?period=' + period);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('activeVehicles');
      expect(res.body).toHaveProperty('avgSoh');
      expect(res.body).toHaveProperty('events');
      expect(Array.isArray(res.body.events)).toBe(true);
      expect(res.body.events.length).toBeGreaterThan(0);
    });
  });

  it('returns 404 for an unknown period', async () => {
    const res = await request(app).get('/api/timeline/snapshot?period=Q4-2099');
    expect(res.status).toBe(404);
  });

  it('TODAY snapshot has 847 active vehicles', async () => {
    const res = await request(app).get('/api/timeline/snapshot?period=TODAY');
    expect(res.body.activeVehicles).toBe(847);
  });
});

// ============================================================
// CORS & preflight
// ============================================================
describe('CORS headers', () => {
  it('returns 204 with CORS headers on OPTIONS preflight', async () => {
    const res = await request(app)
      .options('/api/fleet/stats')
      .set('Origin', 'http://example.com');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-methods']).toContain('GET');
    expect(res.headers['access-control-allow-methods']).toContain('POST');
  });
});

// ============================================================
// /api/maintenance/schedule
// ============================================================
describe('GET /api/maintenance/schedule', () => {
  it('returns chargingStations and schedule arrays', async () => {
    const res = await request(app).get('/api/maintenance/schedule');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.chargingStations)).toBe(true);
    expect(Array.isArray(res.body.schedule)).toBe(true);
  });

  it('has 3 charging stations', async () => {
    const res = await request(app).get('/api/maintenance/schedule');
    expect(res.body.chargingStations).toHaveLength(3);
  });
});
