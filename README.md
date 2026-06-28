# VoltChain

AI-powered EV supply chain intelligence dashboard with a Node/Express backend and static frontend.

## Run Locally

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

