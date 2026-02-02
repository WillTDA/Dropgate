# Dropgate Best Practices Guide

**Security, Privacy, Deployment, and Operational Best Practices**

Version: 3.0.0
Last Updated: 2025-02-02

---

## Table of Contents

1. [Security Best Practices](#security-best-practices)
2. [Privacy Best Practices](#privacy-best-practices)
3. [Deployment Best Practices](#deployment-best-practices)
4. [Performance Optimization](#performance-optimization)
5. [User Best Practices](#user-best-practices)
6. [Operational Best Practices](#operational-best-practices)
7. [Incident Response](#incident-response)
8. [Compliance and Legal](#compliance-and-legal)

---

## Security Best Practices

### Server Hardening

**Critical: HTTPS Required**
```nginx
# ALWAYS use HTTPS - WebRTC and Web Crypto API require it
server {
    listen 443 ssl http2;
    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    # Modern TLS configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
}
```

**Why**: WebRTC DTLS and Web Crypto API refuse to work over plain HTTP. No exceptions.

### Firewall Configuration

**Minimal exposure**:
```bash
# UFW example
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH (restrict to your IP)
ufw allow 80/tcp    # HTTP (redirect to HTTPS)
ufw allow 443/tcp   # HTTPS
ufw enable
```

**Advanced: IP whitelisting for admin endpoints** (if you add any):
```nginx
location /admin {
    allow 192.168.1.0/24;  # Your network
    deny all;
}
```

### Environment Variable Security

**Never commit secrets**:
```bash
# .env file (add to .gitignore)
P2P_STUN_SERVERS=stun:stun.cloudflare.com:3478
LOG_LEVEL=ERROR

# NOT IN .env (not secrets):
ENABLE_UPLOAD=true
UPLOAD_MAX_FILE_SIZE_MB=100
```

**Use environment-specific configs**:
```bash
# Production
cp .env.example .env.production
chmod 600 .env.production  # Restrict permissions
```

### Rate Limiting

**Prevent abuse**:
```nginx
# Nginx rate limiting
http {
    limit_req_zone $binary_remote_addr zone=upload:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=chunk:10m rate=100r/s;

    server {
        location /upload/init {
            limit_req zone=upload burst=5;
        }

        location /upload/chunk {
            limit_req zone=chunk burst=20;
        }
    }
}
```

**Why**: Prevents DoS attacks and abuse of upload endpoints.

### File Upload Validation

**Server-side validation only** (never trust client):
```javascript
// Already implemented in Dropgate, but verify configuration:
UPLOAD_MAX_FILE_SIZE_MB=100  // Reasonable limit
UPLOAD_MAX_STORAGE_GB=50     // Prevent disk exhaustion
```

**Monitor for abuse**:
```bash
# Check for unusual activity
tail -f /var/log/nginx/access.log | grep "507\|413\|429"
```

### CORS Configuration

**Restrict origins** (if exposing API):
```javascript
// Only if you need CORS
app.use(cors({
  origin: ['https://yourdomain.com'],
  methods: ['GET', 'POST'],
  credentials: false
}));
```

**Best practice**: Don't enable CORS unless necessary. Dropgate serves its own web UI.

---

## Privacy Best Practices

### Minimize Data Collection

**Recommended configuration for maximum privacy**:
```bash
# .env
LOG_LEVEL=ERROR                     # Only errors, no access logs
UPLOAD_PRESERVE_UPLOADS=false       # Ephemeral storage
UPLOAD_MAX_FILE_LIFETIME_HOURS=1    # 1-hour expiration
UPLOAD_MAX_FILE_DOWNLOADS=1         # One-time download
ENABLE_WEB_UI=true                  # Allow web access
```

**Result**: Files auto-delete after 1 hour or 1 download, whichever comes first.

### Logging Best Practices

**What NOT to log**:
```nginx
# Nginx: Disable access logs (file IDs in URLs)
access_log off;

# Or: Log but exclude file IDs
log_format privacy '$remote_addr - [$time_local] "$request_method $scheme://$host" '
                   '$status $body_bytes_sent';
access_log /var/log/nginx/access.log privacy;
```

**Application logs**:
```bash
# ERROR level only
LOG_LEVEL=ERROR

# What gets logged:
# ✅ Server start/stop
# ✅ Critical errors
# ❌ File IDs
# ❌ Client IPs
# ❌ Upload/download events
```

### Reverse Proxy Privacy

**Hide client IPs from application**:
```nginx
# DON'T forward real IP to app
# proxy_set_header X-Real-IP $remote_addr;  # REMOVE THIS
# proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;  # REMOVE THIS

# Keep these for functionality
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
```

**Why**: Application doesn't need client IPs. Less data = better privacy.

### User Communication

**Be transparent**:
```markdown
# Display on web UI
- Files encrypted in browser before upload (zero-knowledge)
- Server cannot decrypt your files
- Files auto-delete after [1 hour / 1 download]
- No user accounts or tracking
- Logs: [ERROR level only / disabled]
```

**Privacy policy** (sample):
> Dropgate stores encrypted files temporarily. We cannot access file contents. Files expire after 1 hour or 1 download. We collect minimal metadata (file size, upload time) required for functionality. IP addresses are not logged.

---

## Deployment Best Practices

### Production Deployment Checklist

**Before going live**:
- [ ] HTTPS configured with valid certificate (Let's Encrypt recommended)
- [ ] Firewall enabled and configured
- [ ] LOG_LEVEL set to ERROR or WARN
- [ ] Storage limits configured (`UPLOAD_MAX_STORAGE_GB`)
- [ ] File size limits configured (`UPLOAD_MAX_FILE_SIZE_MB`)
- [ ] Rate limiting enabled on reverse proxy
- [ ] Monitoring configured (disk usage, errors)
- [ ] Backup strategy defined (if using persistent storage)
- [ ] UPLOAD_PRESERVE_UPLOADS set appropriately
- [ ] Server behind reverse proxy (Nginx/Caddy)
- [ ] Automatic security updates enabled
- [ ] SSH key-only authentication (no passwords)

### Docker Best Practices

**Secure Docker deployment**:
```yaml
version: '3.8'

services:
  dropgate:
    image: dropgate:latest
    container_name: dropgate
    restart: unless-stopped

    # Security: Run as non-root user
    user: "1000:1000"

    # Security: Read-only root filesystem
    read_only: true

    # Security: Minimal capabilities
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE

    # Temporary directories (writable)
    tmpfs:
      - /tmp
      - /app/server/uploads/tmp

    ports:
      - "127.0.0.1:3000:3000"  # Bind to localhost only

    environment:
      - NODE_ENV=production
      - LOG_LEVEL=ERROR
      - UPLOAD_PRESERVE_UPLOADS=false
      - UPLOAD_MAX_STORAGE_GB=10

    volumes:
      # Persistent uploads (if needed)
      - ./data/uploads:/app/server/uploads:rw

    # Resource limits
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          memory: 512M

    # Health check
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/info"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### Systemd Service

**For non-Docker deployments**:
```ini
# /etc/systemd/system/dropgate.service
[Unit]
Description=Dropgate File Sharing Server
After=network.target

[Service]
Type=simple
User=dropgate
Group=dropgate
WorkingDirectory=/opt/dropgate
ExecStart=/usr/bin/node /opt/dropgate/server/server.js
Restart=always
RestartSec=10

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/dropgate/server/uploads

# Environment
Environment=NODE_ENV=production
EnvironmentFile=/opt/dropgate/.env

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=dropgate

[Install]
WantedBy=multi-user.target
```

**Enable and start**:
```bash
systemctl daemon-reload
systemctl enable dropgate
systemctl start dropgate
systemctl status dropgate
```

### Backup Strategy

**If using persistent storage**:
```bash
# Backup script
#!/bin/bash
BACKUP_DIR=/backup/dropgate
DATE=$(date +%Y%m%d_%H%M%S)

# Backup SQLite databases
cp /opt/dropgate/server/uploads/db/*.sqlite "$BACKUP_DIR/db_$DATE.sqlite"

# Backup files (optional - users control their own files)
# tar -czf "$BACKUP_DIR/files_$DATE.tar.gz" /opt/dropgate/server/uploads/*.{uuid}

# Keep only last 7 days
find "$BACKUP_DIR" -name "*.sqlite" -mtime +7 -delete
```

**Cron job**:
```cron
# Daily backup at 2 AM
0 2 * * * /opt/dropgate/backup.sh
```

---

## Performance Optimization

### Node.js Tuning

**Increase memory for large instances**:
```bash
# systemd service
ExecStart=/usr/bin/node --max-old-space-size=4096 /opt/dropgate/server/server.js
```

**For many concurrent uploads**:
```bash
# Increase file descriptor limit
ulimit -n 65536

# In systemd
LimitNOFILE=65536
```

### Nginx Optimization

**For large file uploads**:
```nginx
server {
    # Increase timeouts for large uploads
    client_max_body_size 500M;
    client_body_timeout 300s;
    client_header_timeout 300s;

    # Proxy timeouts
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
    proxy_read_timeout 300s;

    # Buffer sizes
    client_body_buffer_size 256k;
    proxy_buffer_size 16k;
    proxy_buffers 8 16k;
}
```

### Disk I/O Optimization

**Use SSD for uploads directory**:
```bash
# Check disk performance
dd if=/dev/zero of=/opt/dropgate/server/uploads/test bs=1G count=1 oflag=direct
# Should see >100 MB/s on SSD

# Mount with noatime for better performance
# /etc/fstab
/dev/sda1  /opt/dropgate  ext4  noatime,nodiratime  0  2
```

**Separate partition for uploads**:
```bash
# Prevents uploads from filling root partition
mkdir -p /data/dropgate-uploads
mount /dev/sdb1 /data/dropgate-uploads
ln -s /data/dropgate-uploads /opt/dropgate/server/uploads
```

### Monitoring Performance

**Key metrics**:
```bash
# CPU and memory
htop

# Disk I/O
iotop

# Network
iftop

# Application metrics
curl http://localhost:3000/api/info | jq .
```

**Prometheus + Grafana** (advanced):
```yaml
# Add metrics endpoint (requires custom implementation)
# /metrics endpoint for Prometheus scraping
```

---

## User Best Practices

### For File Senders

**Maximize privacy**:
1. **Always use encryption** (default in Dropgate)
   - Files encrypted in browser before upload
   - Server cannot access content

2. **Share links securely**
   - Send download link via secure channel (Signal, encrypted email)
   - **Never** share link publicly (Twitter, forums, etc.)
   - Link contains encryption key in `#fragment` - anyone with link can decrypt

3. **Use short expiration times**
   - Default: 1 hour or 1 download
   - For sensitive data: Use P2P instead (no server storage)

4. **Verify recipient**
   - Confirm recipient has download link before it expires
   - Check if download limit allows retries

5. **Clean up metadata**
   - Remove EXIF data from images before upload
   - Sanitize document metadata (author, company, etc.)

### For File Receivers

**Download safely**:
1. **Verify sender**
   - Confirm link is from expected sender
   - Beware of phishing (check domain)

2. **Download promptly**
   - Files expire quickly (often 1 hour)
   - One-time downloads mean no retries

3. **Scan downloads**
   - Run antivirus on received files
   - Dropgate cannot scan encrypted files server-side

4. **Use P2P when possible**
   - For large files or sensitive data
   - Direct transfer, no server storage

### For P2P Transfers

**Sender best practices**:
1. **Share code securely**
   - Send 9-digit code via secure channel
   - Code is single-use per session

2. **Stay online**
   - Keep browser/app open until transfer completes
   - P2P requires both peers online simultaneously

3. **Use reliable connection**
   - Stable WiFi or Ethernet preferred
   - Avoid mobile data for large files (bandwidth)

**Receiver best practices**:
1. **Enter code quickly**
   - Sender is waiting for connection
   - Timeout possible if delayed

2. **Accept transfer**
   - Review file list before accepting (if preview enabled)
   - Ensure sufficient disk space

3. **Stable connection**
   - Same as sender - reliable network required

---

## Operational Best Practices

### Disk Space Management

**Monitor disk usage**:
```bash
# Alert when 80% full
df -h /opt/dropgate/server/uploads | awk 'NR==2 {if ($5+0 > 80) print "WARNING: Disk 80% full"}'

# Check largest files
du -sh /opt/dropgate/server/uploads/* | sort -rh | head -10
```

**Automated cleanup**:
```bash
# Dropgate handles this, but verify:
# - Expired files cleanup: every 60 seconds
# - Zombie uploads cleanup: every 5 minutes
# - Download-triggered deletion: immediate

# Check cleanup is working
journalctl -u dropgate -f | grep -i cleanup
```

### Monitoring Checklist

**Daily monitoring**:
- [ ] Disk usage < 80%
- [ ] No 507 errors (out of capacity)
- [ ] Service running (`systemctl status dropgate`)
- [ ] HTTPS certificate valid (check expiry)

**Weekly monitoring**:
- [ ] Review error logs for patterns
- [ ] Check for failed uploads (zombie cleanup logs)
- [ ] Verify backups (if applicable)

**Monthly monitoring**:
- [ ] Security updates applied
- [ ] Review rate limiting effectiveness
- [ ] Check for unusual traffic patterns

### Log Management

**Rotate logs**:
```bash
# /etc/logrotate.d/nginx
/var/log/nginx/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 640 nginx adm
}
```

**Application logs** (journalctl):
```bash
# View recent logs
journalctl -u dropgate -n 100

# Follow logs
journalctl -u dropgate -f

# Logs from last hour
journalctl -u dropgate --since "1 hour ago"
```

### Capacity Planning

**Calculate storage needs**:
```javascript
// Users
const avgUsers = 100;        // concurrent users per day
const avgFileSize = 50;      // MB per upload
const avgUploadsPerUser = 2;
const retention = 1;         // hours

// Calculation
const dailyStorage = avgUsers * avgFileSize * avgUploadsPerUser;  // 10,000 MB = 10 GB
const peakStorage = dailyStorage * (retention / 24);  // 417 MB peak if 1-hour retention

// Add 50% buffer
const recommendedStorage = peakStorage * 1.5;  // ~625 MB

// For longer retention
const weeklyRetention = dailyStorage * 7;  // 70 GB for 7-day retention
```

**Scale thresholds**:
- **Disk full** → Increase `UPLOAD_MAX_STORAGE_GB` or reduce retention
- **507 errors frequent** → Increase storage or reduce file size limit
- **Slow uploads** → Check disk I/O, network bandwidth
- **High CPU** → Increase Node.js memory, consider load balancer

---

## Incident Response

### Server Outage

**Diagnosis**:
```bash
# Check service status
systemctl status dropgate

# Check disk space
df -h

# Check system resources
htop

# Check recent logs
journalctl -u dropgate -n 50
```

**Recovery**:
```bash
# Restart service
systemctl restart dropgate

# If disk full
UPLOAD_PRESERVE_UPLOADS=false  # Clear all on restart
systemctl restart dropgate

# Or manually clean
rm -rf /opt/dropgate/server/uploads/*
systemctl restart dropgate
```

### Security Incident

**Suspected breach**:
1. **Immediately**: Take server offline
   ```bash
   systemctl stop dropgate
   ufw disable  # Block all traffic
   ```

2. **Investigate**:
   ```bash
   # Check logs for unusual activity
   journalctl -u dropgate --since "24 hours ago" | grep -i error

   # Check for unauthorized access
   last -a

   # Check for modified files
   find /opt/dropgate -mtime -1 -type f
   ```

3. **Recovery**:
   - Restore from known-good backup
   - Rotate all secrets (STUN server credentials if any)
   - Review firewall rules
   - Update all packages
   - Re-enable with enhanced monitoring

4. **Post-incident**:
   - Document incident
   - Review access logs
   - Improve security measures

### Abuse Handling

**Detecting abuse**:
```bash
# Frequent 507 errors (storage exhaustion attack)
journalctl -u dropgate | grep "507" | wc -l

# Rate limit violations
tail -f /var/log/nginx/error.log | grep "limiting requests"

# Unusual file sizes
find /opt/dropgate/server/uploads -type f -size +100M
```

**Mitigation**:
```bash
# Temporary: Reduce limits
UPLOAD_MAX_FILE_SIZE_MB=10
UPLOAD_MAX_STORAGE_GB=5
systemctl restart dropgate

# Block abusive IP (if identified)
ufw deny from 1.2.3.4

# Permanent: Implement Cloudflare or similar DDoS protection
```

---

## Compliance and Legal

### GDPR Compliance

**Data minimization** (already implemented):
- ✅ No user accounts
- ✅ No persistent tracking
- ✅ Minimal metadata collection
- ✅ Automatic deletion (time/download-based)

**User rights**:
- **Right to access**: Server operator cannot access encrypted content
- **Right to deletion**: Automatic expiration (user can request early deletion via API if you add endpoint)
- **Right to portability**: Users download their own files

**Data Processing Agreement** (sample):
> Dropgate processes file data solely for temporary storage and delivery. We cannot access encrypted file contents. Data is automatically deleted per configured retention policy (default: 1 hour). We collect minimal metadata (file size, upload time) required for system operation.

### DMCA / Copyright

**Safe harbor protection**:
```markdown
# Add to website
Dropgate provides encrypted storage. We cannot view file contents.
For DMCA complaints, contact: [your email]

Required info:
- File ID (from download URL)
- Copyright ownership proof
- Good faith statement
```

**Takedown process**:
1. Verify complaint validity
2. Delete file: `rm /opt/dropgate/server/uploads/{fileId}`
3. Delete metadata: Remove from database
4. Respond to complainant

**Counter-notification**: Allow 10-14 days per DMCA requirements.

### Terms of Service (Sample)

```markdown
# Dropgate Terms of Service

1. **Prohibited Content**
   - Illegal content prohibited
   - Copyright infringement prohibited
   - Malware prohibited

2. **No Warranty**
   - Service provided as-is
   - No uptime guarantee
   - Files may be deleted per retention policy

3. **User Responsibility**
   - You control encryption keys
   - You are responsible for content legality
   - Backup important files

4. **Privacy**
   - See Privacy Policy
   - We cannot access encrypted content
   - Minimal logging (ERROR level)

5. **Termination**
   - We reserve right to terminate service
   - Violating users may be IP-banned
```

---

## Quick Reference

### Recommended Configurations

**High Privacy Instance**:
```bash
LOG_LEVEL=NONE
UPLOAD_PRESERVE_UPLOADS=false
UPLOAD_MAX_FILE_LIFETIME_HOURS=1
UPLOAD_MAX_FILE_DOWNLOADS=1
UPLOAD_MAX_FILE_SIZE_MB=50
UPLOAD_MAX_STORAGE_GB=10
```

**General Purpose Instance**:
```bash
LOG_LEVEL=WARN
UPLOAD_PRESERVE_UPLOADS=true
UPLOAD_MAX_FILE_LIFETIME_HOURS=72
UPLOAD_MAX_FILE_DOWNLOADS=10
UPLOAD_MAX_FILE_SIZE_MB=100
UPLOAD_MAX_STORAGE_GB=50
```

**Enterprise Instance**:
```bash
LOG_LEVEL=INFO
UPLOAD_PRESERVE_UPLOADS=true
UPLOAD_MAX_FILE_LIFETIME_HOURS=0  # No expiration
UPLOAD_MAX_FILE_DOWNLOADS=0       # Unlimited
UPLOAD_MAX_FILE_SIZE_MB=500
UPLOAD_MAX_STORAGE_GB=500
```

### Common Issues

| Issue | Symptom | Solution |
|-------|---------|----------|
| **Upload fails** | 507 error | Increase `UPLOAD_MAX_STORAGE_GB` or clean old files |
| **File too large** | 413 error | Increase `UPLOAD_MAX_FILE_SIZE_MB` and nginx `client_max_body_size` |
| **P2P won't connect** | Connection timeout | Check firewall, verify STUN server, ensure HTTPS |
| **Slow uploads** | Timeout errors | Increase nginx proxy timeouts, check disk I/O |
| **Out of disk** | 507 errors | Reduce retention time or increase disk size |

---

**End of Best Practices Guide**

For technical specifications, see:
- [DGUP-PROTOCOL.md](./DGUP-PROTOCOL.md) - Upload protocol
- [DGDTP-PROTOCOL.md](./DGDTP-PROTOCOL.md) - P2P protocol
- [DATA-LIFECYCLE.md](./DATA-LIFECYCLE.md) - Data management
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
