<div align="center">
   <img alt="Dropgate Logo" src="../dropgate.png" style="width:100px;height:auto;margin-bottom:1rem;" />

   # Dropgate CLI

   <p style="margin-bottom:1rem;">A command-line interface for privacy-first file sharing with Dropgate servers.</p>
</div>

<div align="center">

![license](https://img.shields.io/badge/license-GPL--3.0-blue?style=flat-square)
![version](https://img.shields.io/badge/version-3.0.3-brightgreen?style=flat-square)
![platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=flat-square)

[![discord](https://img.shields.io/discord/667479986214666272?logo=discord\&logoColor=white\&style=flat-square)](https://diamonddigital.dev/discord)
[![buy me a coffee](https://img.shields.io/badge/-Buy%20Me%20a%20Coffee-ffdd00?logo=Buy%20Me%20A%20Coffee\&logoColor=000000\&style=flat-square)](https://www.buymeacoffee.com/willtda)

</div>


## 🌍 Overview

**Dropgate CLI** is the command-line way to upload, download, send, and receive files through a Dropgate Server.
It supports both hosted uploads and direct P2P transfers, all from your terminal.


## ✨ Features

* 🔒 **End-to-End Encryption (E2EE)** | Encrypt on your device before upload, decrypt on the recipient's device. The server doesn't need your key.

* 🌐 **Server Agnostic** | Connect to any compatible Dropgate Server — whether it's self-hosted at home, deployed via Docker, or behind a reverse proxy.

* 🧱 **Privacy by Design** | No telemetry, no analytics, and no personal identifiers. Your data stays between you and your chosen server.

* 🖥️ **Cross-Platform Support** | Available for Windows, macOS, and Linux — as both a Node.js package and standalone executable.

* 📦 **Multi-File Uploads** | Bundle multiple files together in a single upload.

* 🔄 **Direct Transfer (P2P)** | Send and receive files device-to-device, with the server only assisting peer discovery.

* ⚙️ **Persistent Configuration** | Set your default server, lifetime, download limits, and encryption preferences once.

* 🤖 **Scriptable Output** | Use `--json` and `--quiet` flags for easy integration into scripts and automation.


## 📦 Installation

### Standalone Executable

Download the latest prebuilt executable for your OS from the [releases page](https://github.com/WillTDA/Dropgate/releases). No Node.js required.

### From Source

Requires [Node.js](https://nodejs.org/) v20 or later.

```bash
git clone https://github.com/WillTDA/Dropgate.git
cd Dropgate/cli
npm install
npm run build
```

Then run via `node dist/index.js` or link globally with `npm link`.


## 🚀 Usage

### Configure your server

```bash
dropgate config set server https://myserver.com
```

### Upload a file

```bash
dropgate upload -i photo.jpg
```

### Upload multiple files as a bundle

```bash
dropgate upload -i file1.txt -i file2.txt --lifetime 7d
```

### Download from a URL

```bash
dropgate download https://myserver.com/abc123#keyBase64
```

### Send a file via P2P

```bash
dropgate send -i presentation.pptx
```

### Receive a file via P2P

```bash
dropgate receive ABCD-1234
```

### View server info

```bash
dropgate info
```


## 📋 Commands

| Command | Description |
|---------|-------------|
| `upload` | Upload files to a Dropgate server |
| `download` | Download files (via URL, file ID, or share code) |
| `send` | Send files directly via P2P |
| `receive` | Receive files directly via P2P |
| `info` | Show server information and capabilities |
| `config` | Manage CLI configuration |

Run `dropgate <command> --help` for detailed usage of each command.


## ⚙️ Global Options

| Flag | Description |
|------|-------------|
| `--server <url>` | Override the configured server URL |
| `--no-color` | Disable colored output |
| `--quiet` | Suppress non-essential output |
| `--json` | Output results as JSON |
| `--version` | Show CLI version |
| `--help` | Show help text |


## 🛠️ Development

To set up a development environment:

```bash
git clone https://github.com/WillTDA/Dropgate.git
cd Dropgate/cli
npm install
npm run dev
```

The `dev` script watches for changes and rebuilds automatically.


## 🏗️ Building

To build the CLI:

```bash
npm run build
```

To build standalone executables:

```bash
npm run pkg          # Current platform
npm run pkg:win      # Windows
npm run pkg:mac      # macOS (x64 + ARM)
npm run pkg:linux    # Linux (x64 + ARM)
npm run pkg:all      # All platforms
```


## 🔌 Self-Hosting & Networking

Dropgate CLI works seamlessly with **self-hosted Dropgate Servers**, which you can run from your own **home server**, **NAS**, or **cloud VPS**.

It plays nicely with common setups like:

* 🌐 **NGINX** or **Caddy** reverse proxies
* ☁️ **Cloudflare Tunnel**
* 🔒 **Tailscale** private networks


## 📜 License

Dropgate CLI is licensed under the **GPL-3.0 License**.
See the [LICENSE](./LICENSE) file for details.


## 📖 Acknowledgements

* Logo designed by [TheFuturisticIdiot](https://youtube.com/TheFuturisticIdiot)
* Built with [TypeScript](https://www.typescriptlang.org/) and [tsup](https://tsup.egoist.dev/)
* Inspired by the growing need for privacy-respecting, open file transfer tools


## 🙂 Contact Us

* 💬 **Need help or want to chat?** [Join our Discord Server](https://diamonddigital.dev/discord)
* 🐛 **Found a bug?** [Open an issue](https://github.com/WillTDA/Dropgate/issues)
* 💡 **Have a suggestion?** [Submit a feature request](https://github.com/WillTDA/Dropgate/issues/new?labels=enhancement)


<div align="center">
  <a href="https://diamonddigital.dev/">
  <strong>Created and maintained by</strong>
  <img align="center" alt="Diamond Digital Development Logo" src="https://diamonddigital.dev/img/png/ddd_logo_text_transparent.png" style="width:25%;height:auto" /></a>
</div>
