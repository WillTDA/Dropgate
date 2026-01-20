# Privacy and Logging

Shadownloader aims to keep operational logging transparent and minimal. Logging is controlled by the `LOG_LEVEL` environment variable (default: `INFO`) and is exposed to clients via `/api/info`.

When logging is enabled, all log entries include a timestamp and the log level label.

## Log Levels and Data

NONE:
- Disables all server logging

ERROR:
- Server startup/config failures
- File IO errors and unexpected exceptions
- May include system error messages (no user identifiers)

WARN:
- Security or configuration warnings
- Rate limit triggers (no request identifiers)

INFO:
- Server startup and configuration summary
- Feature flags and size/retention limits
- Storage usage summaries

DEBUG:
- User-triggered transfer events (upload init, chunk handling, completion, downloads)
- Cleanup of expired/zombie uploads
- File sizes and capacity values may appear
- No upload session IDs or file IDs are logged

## Notes

- No file contents are logged.
- File sizes are logged to help communicate caps and capacity.
- Use `LOG_LEVEL=DEBUG` only when diagnosing issues, then revert to a higher level.
