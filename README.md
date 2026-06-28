# VoltChain

AI-powered EV supply chain intelligence dashboard with a Node/Express backend and static frontend.

## Project Preview

![VoltChain dashboard preview](docs/voltchain-preview.png)

## What It Includes

- Static frontend dashboard with live EV supply chain visualizations
- Express backend API for fleet stats, battery telemetry, chat replies, quality telemetry, supply-chain nodes, and maintenance schedules
- Server-sent events endpoint for live telemetry updates
- Render Blueprint for deploying the frontend and backend as separate services

## Clone And Run On Localhost

```bash
git clone https://github.com/SaurabhForge/VoltChain.git
cd VoltChain
npm install
npm start
```

Then open:

```text
http://localhost:3000
```

## Local API Links

```text
http://localhost:3000/health
http://localhost:3000/api/fleet/stats
http://localhost:3000/api/battery/telemetry
http://localhost:3000/api/telemetry/stream
```

## Run From Existing Folder

```bash
npm install
npm start
```

Then open `http://localhost:3000`.

## Deploy On Render

This repo includes a `render.yaml` Blueprint with two services:

- `saurabhforge-voltchain-api`: Node/Express backend
- `saurabhforge-voltchain-frontend`: Static frontend

The frontend build writes `frontend/config.js` from `VOLTCHAIN_API_BASE`, so the hosted frontend calls:

```text
https://saurabhforge-voltchain-api.onrender.com
```
