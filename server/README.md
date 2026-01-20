<div align="center">
   <img alt="Shadownloader Logo" src="./public/assets/icon.png" style="width:100px;height:auto;margin-bottom:1rem;" />

   # Shadownloader Server

   <p style="margin-bottom:1rem;">A Node.js-based backend to facilitate secure, privacy-focused file sharing.</p>
</div>

<div align="center">

![license](https://img.shields.io/badge/license-AGPL--3.0-blue?style=flat-square)
![version](https://img.shields.io/badge/version-2.0.0-brightgreen?style=flat-square)
![docker](https://img.shields.io/badge/docker-supported-blue?style=flat-square)

</div>

## Overview
Shadownloader Server provides the API, Web UI, and PeerJS signaling. It supports:
- Standard uploads with optional end-to-end encryption (E2EE).
- Direct transfer (P2P) between browsers using WebRTC.
- One-time download links and configurable expiry.

The server listens on port `52443` and is designed to sit behind a reverse proxy for HTTPS.

## Quick Start (Manual)
```bash
git clone https://github.com/WillTDA/Shadownloader.git
cd Shadownloader/server
npm install
npm start
```

Uploads are disabled by default. To enable the standard upload protocol:

```powershell
$env:ENABLE_UPLOAD="true"
npm start
```

```bash
ENABLE_UPLOAD=true npm start
```

## Docker
```bash
docker run -d \
  -p 52443:52443 \
  -e ENABLE_UPLOAD=true \
  -e UPLOAD_ENABLE_E2EE=true \
  -e UPLOAD_PRESERVE_UPLOADS=true \
  -e UPLOAD_MAX_FILE_SIZE_MB=1000 \
  -v /path/to/uploads:/usr/src/app/uploads \
  --name shadownloader \
  willtda/shadownloader-server:latest
```

If you want uploads to persist across restarts, map `uploads/` to a volume and set `UPLOAD_PRESERVE_UPLOADS=true`.

## Environment Variables
| Variable | Default | Description |
| --- | --- | --- |
| `SERVER_NAME` | `Shadownloader Server` | Display name used in the Web UI and `/api/info`. |
| `ENABLE_UPLOAD` | `false` | Enables the standard upload protocol and routes. |
| `ENABLE_P2P` | `true` | Enables direct transfer (P2P) and PeerJS signaling. |
| `ENABLE_WEB_UI` | `true` | Enables the Web UI at `/`. |
| `P2P_STUN_SERVERS` | `stun:stun.cloudflare.com:3478` | Comma or space separated STUN servers for WebRTC. |
| `PEERJS_DEBUG` | `false` | Enables verbose PeerJS logs. |
| `UPLOAD_ENABLE_E2EE` | `true` | Enables end-to-end encryption for standard uploads. |
| `UPLOAD_PRESERVE_UPLOADS` | `false` | Persist uploads across restarts (uses `uploads/db/`). |
| `UPLOAD_MAX_FILE_SIZE_MB` | `100` | Max file size in MB (0 = unlimited). |
| `UPLOAD_MAX_STORAGE_GB` | `10` | Max total storage in GB (0 = unlimited). |
| `UPLOAD_MAX_FILE_LIFETIME_HOURS` | `24` | Max file lifetime in hours (0 = unlimited). |
| `UPLOAD_ZOMBIE_CLEANUP_INTERVAL_MS` | `300000` | Cleanup interval for incomplete uploads (0 = disabled). |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window in milliseconds (0 = disabled). |
| `RATE_LIMIT_MAX_REQUESTS` | `25` | Requests per window (0 = disabled). |
| `LOG_LEVEL` | `INFO` | `NONE`, `ERROR`, `WARN`, `INFO`, `DEBUG`. |

Note: the PeerJS mount path is fixed at `/peerjs`.

## Endpoints and URLs
- Web UI: `GET /`
- Server info: `GET /api/info`
- Resolve a share code or URL: `POST /api/resolve` with `{ "value": "..." }`
- Standard uploads: `POST /upload/init`, `POST /upload/chunk`, `POST /upload/complete`
- File metadata: `GET /api/file/:fileId/meta`
- One-time download stream: `GET /api/file/:fileId`
- Download page: `GET /:fileId`
- Direct transfer page: `GET /p2p/:code`
- PeerJS signaling: `GET /peerjs`

## Storage and Lifecycle
- Uploaded files live in `server/uploads`.
- Files are deleted after the first successful download.
- Expired files are cleaned up automatically.
- When `UPLOAD_PRESERVE_UPLOADS=false`, uploads are cleared on startup and shutdown.

## HTTPS and Reverse Proxies
Encrypted downloads and P2P transfers require HTTPS (localhost is the only exception). Run the server behind a reverse proxy that terminates TLS:
- NGINX
- Caddy
- Cloudflare Tunnel
- Tailscale Funnel

## Logging and Privacy
See `docs/PRIVACY.md` for log levels and data handling details, and `docs/TROUBLESHOOTING.md` for debug tips.

## License
Licensed under the AGPL-3.0-only License. See `server/LICENSE` for details.

## Contact
- Help or chat: https://diamonddigital.dev/discord
- Bugs: https://github.com/WillTDA/Shadownloader/issues
- Feature requests: https://github.com/WillTDA/Shadownloader/issues/new?labels=enhancement

<div align="center">
  <a href="https://diamonddigital.dev/">
  <strong>Created and maintained by</strong>
  <img align="center" alt="Diamond Digital Development Logo" src="https://diamonddigital.dev/img/png/ddd_logo_text_transparent.png" style="width:25%;height:auto" /></a>
</div>
