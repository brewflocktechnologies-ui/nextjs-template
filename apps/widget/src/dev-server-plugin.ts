// Makes `vite dev` and `vite preview` behave like the widget's static host (D-14):
// - applies the frame response headers (ENDP-03) to /v1/frame/ paths;
// - serves `<dir>/index.html` for a request to `<dir>/`, as static hosts do, because the widget
//   uses appType 'mpa' and Vite does not resolve directory indexes for public files.
// PoC-A extends this plugin with the failure-mode fixtures and the telemetry sink.
import fs from 'node:fs';
import path from 'node:path';
import type { Connect, Plugin } from 'vite';
import { FRAME_HEADERS, isFramePath } from './headers.config';

const applyFrameHeaders: Connect.NextHandleFunction = (req, res, next) => {
  if (req.url && isFramePath(req.url)) {
    for (const [name, value] of Object.entries(FRAME_HEADERS)) {
      res.setHeader(name, value);
    }
  }
  next();
};

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
        if (fs.existsSync(candidate)) {
          req.url = `${pathname}index.html${query ? `?${query}` : ''}`;
        }
      }
    }
    next();
  };
}

export function widgetOriginPlugin(): Plugin {
  return {
    name: 'byteflock-widget-origin',
    configureServer(server) {
      server.middlewares.use(applyFrameHeaders);
      if (server.config.publicDir) {
        server.middlewares.use(directoryIndex(server.config.publicDir));
      }
    },
    configurePreviewServer(server) {
      server.middlewares.use(applyFrameHeaders);
      server.middlewares.use(
        directoryIndex(
          path.resolve(server.config.root, server.config.build.outDir),
        ),
      );
    },
  };
}
