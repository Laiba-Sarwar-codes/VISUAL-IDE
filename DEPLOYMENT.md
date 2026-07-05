# Production Deployment

This project should be deployed as a **Node Web Service**, not as a static site.
The Nuxt server serves the application and the `/collab-signal` WebSocket route
from the same HTTPS domain.

## Pre-deployment validation

```bash
npm ci
npm run check
```

## Render deployment

1. Push this folder to a GitHub repository. Do not commit `node_modules`, `.nuxt`, or `.output`.
2. In Render, create a **Blueprint** from the repository. Render will read `render.yaml`.
3. Choose the Free instance for a demo, or a paid instance for dependable always-on room collaboration.
4. After deployment, open:
   - `/` for the application
   - `/health` for the health check
5. Test collaboration in two separate browser profiles/windows.

## Manual dashboard settings (instead of Blueprint)

- Service type: Web Service
- Runtime: Node
- Build command: `npm ci && npm run build`
- Start command: `npm run start`
- Health check path: `/health`
- Environment: `NODE_VERSION=22.18.0`, `HOST=0.0.0.0`

## Optional TURN relay

STUN-only WebRTC works on many networks, but not all. For reliable cross-network
connections, set the following Render build environment variables and redeploy:

- `VITE_TURN_URLS`
- `VITE_TURN_USERNAME`
- `VITE_TURN_CREDENTIAL`

These are client-visible values. Use restricted or short-lived TURN credentials,
not a private provider API key.

## Important architecture notes

- Projects, assets, history, and settings are stored in each browser using IndexedDB/local storage.
- The signaling room map is in memory. Keep the service at one instance unless signaling is moved to a shared store/pub-sub layer.
- The manual direct-link collaboration mode does not need the WebSocket server.
- HTTPS is required for service workers, clipboard access, and reliable browser APIs; Render provides HTTPS automatically.
