/**
 * The single guard for development-only code (D-12): the dev session adapter, `/dev/session`, the
 * publish stub's file writes and the theme fixture override. Everything dev-only asks this.
 */
export function isDevOnly(): boolean {
  return process.env.NODE_ENV !== 'production';
}
