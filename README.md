<div align="center">
  <img alt="Shadownloader Logo" src="./shadownloader.png" style="width:100px;height:auto;margin-bottom:1rem;" />

  # Shadownloader

  <p style="margin-bottom:1rem;">A self-hostable, privacy-first file sharing system with both hosted upload and direct P2P transfer capabilities.</p>
</div>

<div align="center">

![license](https://img.shields.io/badge/license-Mixed-lightgrey?style=flat-square)
![platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey?style=flat-square)

[![discord](https://img.shields.io/discord/667479986214666272?logo=discord&logoColor=white&style=flat-square)](https://diamonddigital.dev/discord)
[![buy me a coffee](https://img.shields.io/badge/-Buy%20Me%20a%20Coffee-ffdd00?logo=Buy%20Me%20A%20Coffee&logoColor=000000&style=flat-square)](https://www.buymeacoffee.com/willtda)

</div>

## Overview
Shadownloader offers two ways to share files:
- Standard uploads: the server stores a file until it is downloaded or expires.
- Direct transfer (P2P): files move browser-to-browser via WebRTC, with the server only handling signaling.

The project ships as:
- [Shadownloader Client](./client/README.md): an Electron desktop app focused on standard uploads.
- [Shadownloader Server](./server/README.md): the Node.js backend that hosts the API, Web UI, and P2P signaling.

## How It Works
### Standard upload
- Files are chunked and uploaded to the server.
- Optional end-to-end encryption uses AES-GCM, with the key stored in the URL hash.
- Download links look like `https://host/<fileId>` (or `https://host/<fileId>#<key>` for E2EE).
- Files are deleted after download or when they expire.

### Direct transfer (P2P)
- The server hosts a PeerJS signaling endpoint at `/peerjs`.
- The sender shares a short code like `ABCD-1234` or a link like `https://host/p2p/ABCD-1234`.
- The file transfers directly between browsers; nothing is stored server-side.

## Key Features
- Optional end-to-end encryption for standard uploads (keys never reach the server).
- One-time download links and automatic expiry.
- Built-in Web UI for sending and receiving without installing anything.
- Direct transfer (P2P) for large files or zero storage usage.
- Configurable limits, rate limiting, and logging.

## Project Structure
```
/Shadownloader
  client/    # Electron desktop app (GPL-3.0-only)
  server/    # Node.js server + Web UI (AGPL-3.0-only)
  docs/      # Privacy and troubleshooting notes
```

## Getting Started
- Server setup and configuration: see `server/README.md`.
- Desktop client usage and builds: see `client/README.md`.

## Docs
- `docs/PRIVACY.md`
- `docs/TROUBLESHOOTING.md`

## Licenses
- Client: GPL-3.0-only. See `client/LICENSE`.
- Server: AGPL-3.0-only. See `server/LICENSE`.

## Contact
- Help or chat: https://diamonddigital.dev/discord
- Bugs: https://github.com/WillTDA/Shadownloader/issues
- Feature requests: https://github.com/WillTDA/Shadownloader/issues/new?labels=enhancement

<div align="center">
  <a href="https://diamonddigital.dev/">
  <strong>Created and maintained by</strong>
  <img align="center" alt="Diamond Digital Development Logo" src="https://diamonddigital.dev/img/png/ddd_logo_text_transparent.png" style="width:25%;height:auto" /></a>
</div>
