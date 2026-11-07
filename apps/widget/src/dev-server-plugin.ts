// Applies the widget origin's response headers in `vite dev` and `vite preview` (D-14).
// PoC-A extends this plugin with the failure-mode fixtures and the telemetry sink.
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

export function widgetOriginPlugin(): Plugin {
  return {
    name: 'byteflock-widget-origin',
    configureServer(server) {
      server.middlewares.use(applyFrameHeaders);
    },
    configurePreviewServer(server) {
      server.middlewares.use(applyFrameHeaders);
    },
  };
}
