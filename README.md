<div align="center">
   <img alt="Shadownloader Logo" src="./shadownloader.png" style="width:100px;height:auto;margin-bottom:1rem;" />

   # Shadownloader

   <p style="margin-bottom:1rem;">A privacy-first, end-to-end encrypted file sharing system built for simplicity, security, and self-hosting.</p>
</div>

<div align="center">

![license](https://img.shields.io/badge/license-Mixed-lightgrey?style=flat-square)
![platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey?style=flat-square)

[![discord](https://img.shields.io/discord/667479986214666272?logo=discord&logoColor=white&style=flat-square)](https://diamonddigital.dev/discord)
[![buy me a coffee](https://img.shields.io/badge/-Buy%20Me%20a%20Coffee-ffdd00?logo=Buy%20Me%20A%20Coffee&logoColor=000000&style=flat-square)](https://www.buymeacoffee.com/willtda)

</div>


## 🌍 Overview

**Shadownloader** is a modern, privacy-respecting file sharing system composed of two parts:
- [**Shadownloader Client**](./client/README.md): A lightweight Electron app for uploading, encrypting, and sharing files.
- [**Shadownloader Server**](./server/README.md): A Node.js backend built to handle secure file delivery, with optional end-to-end encryption and configurable storage.

In today’s world, privacy and anonymity are more important than ever.  
Shadownloader was designed to make **secure file sharing accessible**, **transparent**, and **fully self-hostable** — whether on a home NAS, VPS, or Docker container.


## ✨ Features

- 🔐 **End-to-End Encryption (E2EE)** – Files are encrypted client-side and decrypted only by the recipient.
- 🕵️ **Privacy First** – No analytics, no tracking, no logging of file contents.
- ⚙️ **Configurable Server Controls** – Easily tune file size limits, rate limits, and file persistence.
- 💻 **Cross-Platform Client** – Built with Electron for a smooth experience on Windows, macOS, and Linux.
- 🧩 **Self-Host Ready** – Deploy with Docker, NGINX, Caddy, Cloudflare Tunnel, or even Tailscale.
- 🧠 **Lightweight and Fast** – Minimal dependencies and a focus on clean, efficient file transfers.


## 🧰 Project Structure

```

/Shadownloader
├── client/    # Electron-based uploader app (GPL-3.0)
├── server/    # Node.js-based file server with customisable settings (AGPL-3.0)

````


## 🧩 Getting Started

### Clone the Repository
```bash
git clone https://github.com/WillTDA/Shadownloader.git
cd Shadownloader
````

### Client

See the [client README](./client/README.md) for setup and build instructions.

### Server

See the [server README](./server/README.md) for configuration, Docker setup, and deployment.


## 🔒 Privacy and Security Philosophy

Shadownloader’s design ensures **you stay in control of your data**:

* E2EE ensures that even the server operator cannot read your files.
* Temporary uploads are securely deleted after download.
* Self-hosting means your files never touch third-party storage unless *you choose to use it*.

Whether you deploy via Docker, Cloudflare Tunnel, or on your home server,
Shadownloader keeps your files **private**, **ephemeral**, and **under your control**.


## 📜 Licenses

* **Client:** GPL-3.0 License – See [`client/LICENSE`](./client/LICENSE)
* **Server:** AGPL-3.0 License – See [`server/LICENSE`](./server/LICENSE)


## 📖 Acknowledgements

* Logo designed by [TheFuturisticIdiot](https://youtube.com/TheFuturisticIdiot)
* Built with [Electron](https://www.electronjs.org/) and [Node.js](https://www.nodejs.org/)
* Inspired by the growing need for privacy-respecting, open file transfer tools


## 🙂 Contact Us

* 💬 **Need help or want to chat?** [Join our Discord Server](https://diamonddigital.dev/discord)
* 🐛 **Found a bug?** [Open an issue](https://github.com/WillTDA/Shadownloader/issues)
* 💡 **Have a suggestion?** [Submit a feature request](https://github.com/WillTDA/Shadownloader/issues/new?labels=enhancement)


<div align="center">
  <a href="https://diamonddigital.dev/">
  <strong>Created and maintained by</strong>
  <img align="center" alt="Diamond Digital Development Logo" src="https://diamonddigital.dev/img/png/ddd_logo_text_transparent.png" style="width:25%;height:auto" /></a>
</div>