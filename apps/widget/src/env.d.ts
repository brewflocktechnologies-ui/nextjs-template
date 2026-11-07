// Build-time constants injected by Vite `define` (apps/widget/vite.config.mts and scripts/build.mjs).

/** Origin allowed to send theme.preview in mode=preview (P1.6). */
declare const __DASHBOARD_ORIGIN__: string;
/** Parent origins for which mode=test exposes window.__byteflockBridgeStats (playground only). */
declare const __PLAYGROUND_ORIGINS__: readonly string[];
/** Reported in telemetry beacons. */
declare const __FRAME_VERSION__: string;
/** Path of the launcher module on the widget origin, baked into the loader. */
declare const __LAUNCHER_PATH__: string;
