# Dropgate Technical Documentation

This directory contains comprehensive technical specifications for Dropgate's protocols and architecture. Designed for security researchers, contributors, and system administrators.

---

## Quick Navigation

### Protocol Specifications

- **[DGUP Protocol](./DGUP-PROTOCOL.md)** - Dropgate Upload Protocol
  - Hosted file upload protocol with zero-knowledge architecture
  - AES-GCM-256 encryption, chunked uploads, sealed bundle manifests
  - Target audience: Security researchers, client implementers

- **[DGDTP Protocol](./DGDTP-PROTOCOL.md)** - Dropgate Direct Transfer Protocol
  - Peer-to-peer WebRTC file transfer protocol
  - Multi-file support (Protocol v3), flow control, reliability mechanisms
  - Target audience: P2P client developers, WebRTC engineers

### Architecture and Data

- **[Data Lifecycle](./DATA-LIFECYCLE.md)** - Privacy Architecture and Data Management
  - What data Dropgate stores, where, why, and when it's deleted
  - Zero-knowledge guarantees, compliance considerations
  - Target audience: Privacy advocates, system administrators

- **[System Architecture](./ARCHITECTURE.md)** - Deployment and Integration
  - Component overview, API reference, deployment guide
  - Environment variables, reverse proxy configuration, Docker
  - Target audience: System administrators, DevOps engineers

---

## Protocol Naming

| Protocol | Acronym | Description |
|----------|---------|-------------|
| **Upload** | **DGUP** | Dropgate Upload Protocol |
| **P2P/Direct Transfer** | **DGDTP** | Dropgate Direct Transfer Protocol |

---

## Key Features

### DGUP (Upload) Highlights

- ✅ **Zero-knowledge architecture**: Server cannot decrypt encrypted content
- ✅ **AES-GCM-256 client-side encryption**: Files encrypted before transmission
- ✅ **5MB chunked uploads**: Reliable transfer with SHA-256 verification
- ✅ **Sealed bundle manifests**: Server-blind multi-file uploads
- ✅ **Configurable expiration**: Time-based and download-count-based deletion

### DGDTP (P2P) Highlights

- ✅ **WebRTC peer-to-peer**: No server storage, direct transfers
- ✅ **Protocol v3 multi-file support**: Sequential file transfer with boundaries
- ✅ **Flow control**: Chunk acknowledgments + buffer management
- ✅ **Reliability**: End-ack retries, heartbeat, watchdog timeout
- ✅ **8-character sharing codes**: Format `XXXX-0000` (e.g., `ABCD-1234`, 24 letters + 4 digits)

---

## Reference Implementation

All protocols are implemented in the Dropgate monorepo:

- **Client SDK**: [/packages/dropgate-core/](../../packages/dropgate-core/) (headless TypeScript library)
- **Server**: [/server/](../../server/) (Node.js + Express)
- **Electron App**: [/client/](../../client/)
- **Web UI**: [/server/public/](../../server/public/)

---

## Version Compatibility

- **DGUP Protocol**: Based on Dropgate 3.0.0
- **DGDTP Protocol**: Version 3 (multi-file support)
- **API Version**: Check `/api/info` endpoint for server capabilities

---

## For Contributors

If you're implementing a compatible client:

1. **Read** [DGUP-PROTOCOL.md](./DGUP-PROTOCOL.md) for upload implementation details
2. **Read** [DGDTP-PROTOCOL.md](./DGDTP-PROTOCOL.md) for P2P implementation details
3. **Reference** [@dropgate/core](../../packages/dropgate-core/) for SDK usage examples
4. **Test** against a live Dropgate server to verify compatibility

### Implementation Checklists

**DGUP client checklist**:
- [ ] Generate AES-GCM-256 key using Web Crypto API
- [ ] Encrypt each chunk with unique IV
- [ ] Calculate SHA-256 hash of encrypted chunks
- [ ] Implement exponential backoff retry logic
- [ ] Handle 507 (insufficient storage) gracefully
- [ ] Embed key in URL fragment (`#key=...`)
- [ ] Support bundle uploads with sealed manifests

**DGDTP client checklist**:
- [ ] Integrate PeerJS library
- [ ] Implement protocol version 3 message handling
- [ ] Build sender and receiver state machines
- [ ] Implement chunk-level acknowledgments
- [ ] Monitor data channel buffer
- [ ] Implement heartbeat mechanism (ping/pong)
- [ ] Implement end-ack retry with exponential backoff
- [ ] Handle multi-file transfers

---

## For Security Researchers

We welcome security audits. Key areas of interest:

### Encryption

- **Implementation**: [/packages/dropgate-core/src/crypto/](../../packages/dropgate-core/src/crypto/)
- **Algorithm**: AES-GCM-256 with 12-byte IV and 16-byte authentication tag
- **Key management**: Client-side generation, URL fragment storage
- **Concerns**: IV uniqueness, key isolation, sealed manifest integrity

### State Machines

- **P2P sender**: [send.ts](../../packages/dropgate-core/src/p2p/send.ts)
- **P2P receiver**: [receive.ts](../../packages/dropgate-core/src/p2p/receive.ts)
- **Concerns**: State transition validation, race conditions, message ordering

### Server Isolation

- **Upload handling**: [server.js:388-906](../../server/server.js#L388-L906)
- **Zero-knowledge**: Server cannot decrypt encrypted content
- **Concerns**: Metadata leakage, timing attacks, storage quota bypass

### Attack Surface

- **Upload endpoints**: Quota enforcement, zombie cleanup, hash verification
- **P2P signaling**: Protocol version negotiation, session validation
- **Cleanup mechanisms**: Race conditions, orphan files

**Reporting**: Please report security issues to the repository maintainers.

---

## For System Administrators

### Quick Start

1. **Install**: Clone repository, `npm install`
2. **Configure**: Set environment variables (see [ARCHITECTURE.md](./ARCHITECTURE.md#environment-variables))
3. **Deploy**: Run behind HTTPS reverse proxy (see [ARCHITECTURE.md](./ARCHITECTURE.md#reverse-proxy-configuration))
4. **Monitor**: Track disk usage, error rates, connection success rates

### Recommended Configuration

**Production**:
```bash
# .env
SERVER_PORT=52443
LOG_LEVEL=WARN                      # Minimal logging
ENABLE_UPLOAD=true
UPLOAD_PRESERVE_UPLOADS=true        # Persistent storage
UPLOAD_MAX_STORAGE_GB=100           # 100GB quota
UPLOAD_MAX_FILE_LIFETIME_HOURS=72   # 3-day expiration
ENABLE_P2P=true
```

**Privacy-focused**:
```bash
# .env
LOG_LEVEL=ERROR                     # Errors only
UPLOAD_PRESERVE_UPLOADS=false       # Clear on restart
UPLOAD_MAX_FILE_LIFETIME_HOURS=1    # 1-hour expiration
UPLOAD_MAX_FILE_DOWNLOADS=1         # One-time download
```

### Security Hardening

See [ARCHITECTURE.md - Security Hardening Checklist](./ARCHITECTURE.md#security-hardening-checklist):

- [ ] Run behind HTTPS reverse proxy
- [ ] Set `LOG_LEVEL=ERROR` or `NONE`
- [ ] Configure reverse proxy to NOT log request paths
- [ ] Set reasonable storage limits
- [ ] Monitor disk usage
- [ ] Enable automatic security updates

---

## Documentation Overview

### [DGUP-PROTOCOL.md](./DGUP-PROTOCOL.md)

**~1000 lines** | **12 sections** | **6 diagrams** | **11 tables**

Comprehensive specification for the Dropgate Upload Protocol including:
- Cryptographic specification (AES-GCM-256)
- Upload session lifecycle (with sequence diagram)
- Chunked upload flow
- Bundle upload system (with flowchart)
- Server-side processing (quota management)
- Download and deletion (with decision tree)
- Zombie upload cleanup (with table)
- Security guarantees (server blindness matrix)
- Complete API reference

### [DGDTP-PROTOCOL.md](./DGDTP-PROTOCOL.md)

**~900 lines** | **15 sections** | **6 diagrams** | **8 tables**

Comprehensive specification for the Dropgate Direct Transfer Protocol including:
- WebRTC connection establishment (with sequence diagram)
- Complete message type reference (16 message types)
- Protocol flow diagrams (single and multi-file)
- State machines (sender and receiver with diagrams)
- Flow control and reliability (with flowchart)
- Connection health and heartbeat
- End acknowledgment retry mechanism
- Security considerations (DTLS encryption)
- Multi-file transfer implementation
- Client SDK API reference

### [DATA-LIFECYCLE.md](./DATA-LIFECYCLE.md)

**~700 lines** | **12 sections** | **5 diagrams** | **7 tables**

Complete data processing, storage, and privacy documentation including:
- Zero-knowledge architecture overview
- Data inventory (what Dropgate stores)
- Database schema (with ER diagram)
- Upload lifecycle (with flowchart)
- Download lifecycle (with sequence diagram)
- Three cleanup mechanisms (with gantt chart)
- Server blindness guarantees (comprehensive table)
- Storage quota management
- Logging and privacy (behavior by level)
- Data persistence configuration
- GDPR and compliance considerations

### [ARCHITECTURE.md](./ARCHITECTURE.md)

**~500 lines** | **11 sections** | **2 diagrams** | **5 tables**

System architecture and deployment guide including:
- Component architecture (with diagram)
- Complete API endpoint reference
- Deployment architecture (with diagram)
- Complete environment variables reference
- Reverse proxy configuration (Nginx, Caddy)
- Docker deployment (docker-compose example)
- Security hardening checklist
- Capacity planning
- Monitoring recommendations

---

## Diagrams

This documentation includes **14 Mermaid diagrams**:

- **5 Sequence Diagrams**: Upload session, WebRTC connection, single-file P2P, multi-file P2P, download lifecycle
- **4 Flowcharts**: Bundle upload decision, flow control logic, upload lifecycle, download decision tree
- **2 State Diagrams**: P2P sender state machine, P2P receiver state machine
- **2 Component Diagrams**: Component architecture, deployment architecture
- **1 ER Diagram**: Database schema
- **1 Gantt Chart**: Cleanup process timing

---

## Tables

This documentation includes **20+ comprehensive tables**:

- Protocol characteristics and key features
- Cryptographic constants and parameters
- Message type specifications (DGDTP)
- Storage quota management
- Cleanup mechanisms
- Environment variables (complete reference)
- API endpoints (complete reference)
- Server blindness guarantees
- Logging behavior by level
- Error scenarios and handling
- And more...

---

## Contributing

### Documentation Improvements

To improve this documentation:

1. **Fork** the repository
2. **Edit** markdown files in `/docs/technical/`
3. **Test** diagrams render correctly (Mermaid)
4. **Verify** all links work
5. **Submit** pull request

### Code Contributions

See main repository for code contribution guidelines.

---

## License

This documentation is part of the Dropgate project. See [LICENSE](../../LICENSE) for details.

---

## Questions?

- **General questions**: See main [README](../../README.md)
- **Troubleshooting**: See [TROUBLESHOOTING.md](../TROUBLESHOOTING.md)
- **Privacy**: See [PRIVACY.md](../PRIVACY.md)
- **Security issues**: Report to repository maintainers

---

**Last Updated**: 2026-02-05
**Dropgate Version**: 3.0.0
