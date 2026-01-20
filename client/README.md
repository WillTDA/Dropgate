<div align="center">
   <img alt="Shadownloader Logo" src="./src/img/shadownloader.png" style="width:100px;height:auto;margin-bottom:1rem;" />

   # Shadownloader Client

   <p style="margin-bottom:1rem;">An Electron-based, privacy-first file sharing client built for secure communication with Shadownloader servers.</p>
</div>

<div align="center">

![license](https://img.shields.io/badge/license-GPL--3.0-blue?style=flat-square)
![version](https://img.shields.io/badge/version-2.0.0-brightgreen?style=flat-square)
![platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=flat-square)

[![discord](https://img.shields.io/discord/667479986214666272?logo=discord&logoColor=white&style=flat-square)](https://diamonddigital.dev/discord)
[![buy me a coffee](https://img.shields.io/badge/-Buy%20Me%20a%20Coffee-ffdd00?logo=Buy%20Me%20A%20Coffee&logoColor=000000&style=flat-square)](https://www.buymeacoffee.com/willtda)

</div>

## Overview
Shadownloader Client is a lightweight desktop uploader for the server. It uses the same API as the Web UI and checks server capabilities before uploading.

## Features
- Chunked uploads with progress reporting.
- Optional end-to-end encryption (AES-GCM). Keys stay in the URL hash.
- File lifetime controls (minutes, hours, days, or unlimited within server limits).
- Server compatibility checks via `/api/info`.
- Copies the final download link to the clipboard.
- Windows context menu integration for background uploads.

## Installation
1. Download the latest release from https://github.com/WillTDA/Shadownloader/releases.
2. Install or extract the app for your OS.
3. Launch the client and set your server URL.

## Usage
1. Enter the server URL (for example `https://files.example.com`).
2. Select a file or drag it into the app.
3. Choose lifetime and E2EE options (if supported).
4. Click Upload. The link is copied to your clipboard.

### Windows context menu
After installing the Windows build, right-click a file and choose:
- "Share with Shadownloader"
- "Share with Shadownloader (E2EE)"

Uploads run in the background and copy the link to the clipboard when finished.

## Direct Transfer (P2P)
The desktop client focuses on standard uploads. Direct transfer is available in the server Web UI at `https://your-host/`.

## Development
```bash
git clone https://github.com/WillTDA/Shadownloader.git
cd Shadownloader/client
npm install
npm start
```

## Building
```bash
npm run build
```

Distributable binaries will appear in the `dist` folder.

## License
Shadownloader Client is licensed under the GPL-3.0-only License. See `client/LICENSE` for details.

## Contact
- Help or chat: https://diamonddigital.dev/discord
- Bugs: https://github.com/WillTDA/Shadownloader/issues
- Feature requests: https://github.com/WillTDA/Shadownloader/issues/new?labels=enhancement

<div align="center">
  <a href="https://diamonddigital.dev/">
  <strong>Created and maintained by</strong>
  <img align="center" alt="Diamond Digital Development Logo" src="https://diamonddigital.dev/img/png/ddd_logo_text_transparent.png" style="width:25%;height:auto" /></a>
</div>
