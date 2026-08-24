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
