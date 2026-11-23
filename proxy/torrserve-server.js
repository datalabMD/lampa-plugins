import { pathToFileURL } from 'node:url';
import express from 'express';
import { createTorrserveGateway } from './torrserve-gateway.js';

export function createTorrserveApp(env) {
  const app = express();
  app.disable('x-powered-by');
  const gateway = createTorrserveGateway(env);
  const addon = gateway.renderAddon();

  app.get('/health', (req, res) => {
    res.set('Cache-Control', 'no-store').status(gateway.enabled ? 200 : 503)
      .json({ torrserveGateway: gateway.enabled });
  });
  app.get('/plugin.js', (req, res) => {
    res.set('Access-Control-Allow-Origin', '*').set('Cache-Control', 'no-store')
      .type('application/javascript').status(gateway.enabled ? 200 : 503).send(addon);
  });
  app.use('/torrserve', express.raw({ type: '*/*', limit: '16kb' }), gateway.handler);
  app.use((req, res) => res.status(404).end());
  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createTorrserveApp(process.env).listen(process.env.PORT || 3000, '0.0.0.0');
}
