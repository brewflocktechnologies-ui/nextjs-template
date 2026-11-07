// Makes `vite dev` and `vite preview` behave like the widget's static host (D-14), plus the
// failure-mode fixtures PoC-A needs:
// - response headers from headers.config.ts (ENDP-01, ENDP-03);
// - `<dir>/index.html` for a request to `<dir>/` in public/ (appType 'mpa' does not do this);
// - dev only: /v1/loader.js compiled from src/loader.ts as a classic script;
// - dev only: /v1/config/wk_slow.json answers after 3 s (the frame times out at 2 s);
// - POST /v1/telemetry → 204, logged, and kept in memory for GET /v1/dev/telemetry (dev and preview).
import fs from 'node:fs';
import path from 'node:path';
import type { Connect, Plugin } from 'vite';
import { transformWithOxc } from 'vite';
import { headersFor } from './headers.config.ts';

const SLOW_DELAY_MS = 3000;
const telemetry: unknown[] = [];

function applyHeaders(dev: boolean): Connect.NextHandleFunction {
  return (req, res, next) => {
    if (req.url) {
      for (const [name, value] of Object.entries(headersFor(req.url, { dev })))
        res.setHeader(name, value);
    }
    next();
  };
}

function directoryIndex(rootDir: string): Connect.NextHandleFunction {
  return (req, _res, next) => {
    if (req.url) {
      const [pathname, query] = req.url.split('?');
      if (pathname.endsWith('/') && pathname !== '/') {
        const candidate = path.join(
          rootDir,
          ...pathname.split('/'),
          'index.html',
        );
        if (fs.existsSync(candidate))
          req.url = `${pathname}index.html${query ? `?${query}` : ''}`;
      }
    }
    next();
  };
}

const telemetrySink: Connect.NextHandleFunction = (req, res, next) => {
  const pathname = req.url?.split('?')[0];
  if (pathname === '/v1/telemetry' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        telemetry.push(JSON.parse(body));
      } catch {
        telemetry.push({ invalid: body.slice(0, 200) });
      }
      if (telemetry.length > 200) telemetry.shift();
      console.log(`[telemetry] ${body}`);
      res.statusCode = 204;
      res.end();
    });
    return;
  }
  if (pathname === '/v1/dev/telemetry' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(JSON.stringify(telemetry));
    return;
  }
  if (pathname === '/v1/dev/telemetry' && req.method === 'DELETE') {
    telemetry.length = 0;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.statusCode = 204;
    res.end();
    return;
  }
  next();
};

const slowConfig: Connect.NextHandleFunction = (req, _res, next) => {
  if (req.url?.split('?')[0] === '/v1/config/wk_slow.json')
    setTimeout(next, SLOW_DELAY_MS);
  else next();
};

function devLoader(root: string): Connect.NextHandleFunction {
  return async (req, res, next) => {
    if (req.url?.split('?')[0] !== '/v1/loader.js') return next();
    try {
      const source = fs.readFileSync(
        path.join(root, 'src', 'loader.ts'),
        'utf8',
      );
      // The loader is already a self-contained IIFE with no imports: strip types, substitute the path.
      const result = await transformWithOxc(source, 'loader.ts', {
        lang: 'ts',
      });
      const code = result.code.replace(
        /__LAUNCHER_PATH__/g,
        JSON.stringify('/src/launcher/index.ts'),
      );
      res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(code);
    } catch (error) {
      next(error);
    }
  };
}

export function widgetOriginPlugin(): Plugin {
  return {
    name: 'byteflock-widget-origin',
    configureServer(server) {
      server.middlewares.use(applyHeaders(true));
      server.middlewares.use(telemetrySink);
      server.middlewares.use(slowConfig);
      server.middlewares.use(devLoader(server.config.root));
      if (server.config.publicDir)
        server.middlewares.use(directoryIndex(server.config.publicDir));
    },
    configurePreviewServer(server) {
      server.middlewares.use(applyHeaders(false));
      server.middlewares.use(telemetrySink);
      server.middlewares.use(slowConfig);
      server.middlewares.use(
        directoryIndex(
          path.resolve(server.config.root, server.config.build.outDir),
        ),
      );
    },
  };
}
