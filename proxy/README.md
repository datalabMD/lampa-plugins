# Lampa Rezka Proxy

CORS/session proxy for the `rezka.js` Lampa plugin.

## Coolify

- Repository: `datalabMD/lampa-plugins`
- Build pack: Dockerfile
- Base directory: `/proxy`
- Dockerfile: `Dockerfile`
- Port: `3000`
- Environment: `ALLOWED_HOSTS=kvk.pub,rezka.fi`

After deployment, open `/health` and expect JSON with `ok: true`.

In Lampa → Settings → HDREZKA set:

- Domain: `https://kvk.pub`
- CORS proxy: `https://YOUR-PROXY-DOMAIN/`

The proxy stores the Rezka session in memory, keyed by client IP + User-Agent. Restarting the container clears sessions, so log in again after a restart.

## Protected TorrServe playback on VIDAA

The optional playback gateway lets Lampa's built-in player open password-protected TorrServe files without putting the password in a video URL. Keep Basic Auth enabled on TorrServe and enter its existing login and password in Lampa.

Set all three variables on this proxy service in Coolify:

| Variable | Example | Purpose |
| --- | --- | --- |
| `TORRSERVE_UPSTREAM` | `http://torrserve:8090` | Fixed private TorrServe origin, reachable from the proxy on the shared Docker network. |
| `TORRSERVE_SOURCE_ORIGIN` | `https://torrserve.example.com` | Public HTTPS TorrServe origin configured in Lampa. |
| `TORRSERVE_GATEWAY_ORIGIN` | `https://lampa-proxy.example.com` | Public HTTPS origin of this proxy. |

Use origins only, without embedded credentials, paths, query strings or fragments. No password or signing secret is needed in the proxy environment. Missing or invalid configuration disables the gateway and omits its player addon from `/plugin.js` and `/p`.

After redeploying, `/health` reports `torrserveGateway: true`. Reload Lampa to load the addon. It exchanges Lampa's existing Basic credentials for a random ticket scoped to one torrent file, valid for up to six hours. The gateway checks those credentials again for every new GET or HEAD request; changing the TorrServe password prevents further requests using an old ticket. Keep ticket URLs private.

Run one proxy replica: tickets and their credentials are held in process memory, with at most 1,024 active tickets. A restart clears them; reopen playback in Lampa to obtain a new ticket. Multiple replicas do not share tickets.

The gateway streams the original bytes with HTTP Range support for seeking. It does not transcode; the television must support the file's codecs. Only direct TorrServe `/stream` playback is supported, not GST/HLS manifests or separate subtitle/audio URLs.

To roll back, remove the three gateway variables and redeploy the proxy. This also removes the addon from newly served plugin scripts. Fully reload Lampa to unload the previously loaded addon; the original TorrServe Basic Auth remains in place.
