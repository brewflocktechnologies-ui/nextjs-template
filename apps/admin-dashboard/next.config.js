//@ts-check
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the workspace root so Turbopack does not infer it from sibling lockfiles.
  turbopack: {
    root: path.join(__dirname, '../..'),
  },
  // TanStack Table ships ESM only; listing it here also makes next/jest transform it (P1.4).
  transpilePackages: ['@tanstack/react-table', '@tanstack/table-core'],
  // The e2e production server builds into its own folder so it cannot wipe a running dev server.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Explicitly off (P1.6-T05): authenticated pages are rendered per request and never cached.
  cacheComponents: false,
  // See: https://nextjs.org/docs/app/api-reference/config/next-config-js
};

module.exports = nextConfig;
