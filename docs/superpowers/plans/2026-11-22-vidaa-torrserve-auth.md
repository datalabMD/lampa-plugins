# VIDAA TorrServe playback authorization

> **For agentic workers:** implement the gateway and player adapter in parallel, then perform an independent review before deployment.

**Goal:** Play password-protected TorrServe files in the existing Hisense VIDAA Lampa player.

**Architecture:** Keep the original TorrServe Basic Auth intact. The existing Lampa proxy will exchange a verified Basic credential for an opaque, temporary playback ticket scoped to one torrent and file. A small adapter in the existing plugin will obtain this ticket before starting the HTML5 player. The gateway pipes bytes with backpressure and Range support.

**Tech stack:** Existing Node 20 + Express service, Node built-in crypto/http/https/stream modules, ES5-compatible browser addon. No new runtime dependency.

## Evidence and requirements

- The same control MP4 request returned 401 without Authorization and 206 with Authorization (1024 real bytes).
- Lampa attaches Basic Auth to AJAX, but the cross-origin HTML5 video request has no such header.
- Original protected API and stream URLs remain protected; password is never placed in a public script or media URL.
- Only the configured HTTPS TorrServe source origin and direct `/stream` URLs are eligible. Upstream is a fixed, administrator-configured Docker URL.
- Tickets: 32 random bytes, six-hour maximum lifetime, bounded in-memory store, GET/HEAD only, revoked when their saved Basic credential stops authenticating.
- Canonical upstream uses only a validated 40-hex torrent hash, a positive file index, and `play`; it never forwards an arbitrary URL.
- A proxy restart expires outstanding tickets. Playback can be restarted in Lampa to obtain a new ticket.
- Preserve Lampa callback functions, timeline, torrent identity, quality selection and playlist behavior. Cancel stale asynchronous attempts.
- No transcoding, GST/HLS, subtitle gateway, IP exemptions, VPN, or changes to unrelated proxy behavior in this fix.

## Tasks and validation

- [x] Gateway: `proxy/torrserve-gateway.js`, HTTP integration tests in `proxy/tests/torrserve-gateway.test.js`. Demonstrate the current missing authorization route fails before implementation. Test no/wrong auth, validated URL scope, opaque ticket, password revocation, expiry/capacity, GET/HEAD, 206/416/If-Range, streaming and disconnects, CORS and route isolation.
- [x] Adapter: `proxy/torrserve-addon.js`, VM boundary tests in `proxy/tests/torrserve-addon.test.cjs`. Test synchronous abort, asynchronous replay, credentials only to the fixed endpoint, cancellation and preserving live data/callback references.
- [x] Integration: mount the gateway before the generic proxy; append the configured addon to `/plugin.js` and `/p`; copy the two new files into the existing Docker image. Configuration is disabled unless all three trusted origins are supplied.
- [ ] Review the complete diff and run all repository tests. Commit and publish the reviewed change; deploy the existing application with three non-secret gateway settings.
- [ ] Verify public authorization failures, a valid ticket's real video byte range, preserved original Basic protection, health and unchanged TrackTimecode. Remove only the diagnostic torrent. Ask the user to reload Lampa and test the actual television.

Local validation: all 19 gateway and addon tests pass, including viewer disconnects, the 16 KB body limit and the 16-request authentication concurrency limit. Independent security, streaming and Lampa lifecycle review completed with no remaining blocking findings. Deployment and checks against the live service and television are pending.

## Review focus

Reject SSRF, redirects, duplicate query parameters and token tampering; ensure password changes revoke new range requests. Verify that incoming request completion is not mistaken for viewer disconnect, that full videos are not buffered, and that a stale ticket response cannot launch an earlier selection. Preserve the existing plugin and its diagnostics without adding passwords or playback tickets to them.
