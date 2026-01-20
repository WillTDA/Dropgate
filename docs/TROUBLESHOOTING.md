# Troubleshooting

## Enable debug logging

Set `LOG_LEVEL=DEBUG` in your server environment to see user-triggered transfer events and detailed flow logs. Set `LOG_LEVEL=NONE` to disable all logs.

## Rate limits

If clients are blocked with "Too many requests," increase `RATE_LIMIT_MAX_REQUESTS` or `RATE_LIMIT_WINDOW_MS`. Rate limit triggers are logged at WARN level without identifiers.

## Upload issues

- Check `UPLOAD_MAX_FILE_SIZE_MB`, `UPLOAD_MAX_STORAGE_GB`, and `UPLOAD_MAX_FILE_LIFETIME_HOURS`.
- For encrypted uploads, ensure `UPLOAD_ENABLE_E2EE=true` and run the server behind HTTPS.
- If uploads fail, temporarily enable `LOG_LEVEL=DEBUG` and retry to capture transfer flow.

## P2P issues

- P2P requires HTTPS (localhost is the only exception).
- Ensure `ENABLE_P2P=true` and your STUN servers are reachable (`P2P_STUN_SERVERS`).
