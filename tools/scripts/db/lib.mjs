// Shared helpers for the local database scripts (P2.1-T02, ADR-012). Node only, so they run the
// same on Windows and Linux: Docker is called through child_process, never through a shell.
import { spawnSync } from 'node:child_process';
import path from 'node:path';

export const root = path.resolve(import.meta.dirname, '..', '..', '..');
export const composeFile = path.join(root, 'compose.yaml');
export const SERVICE = 'db';
export const HOST_PORT = 5440;

/** Runs a command with inherited output; returns its exit status. */
export function run(cmd, args, { quiet = false } = {}) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: quiet ? 'pipe' : 'inherit',
    encoding: 'utf8',
  });
  if (result.error)
    return { status: 1, stdout: '', stderr: String(result.error.message) };
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

export function compose(args, options) {
  return run('docker', ['compose', '-f', composeFile, ...args], options);
}

/** Exits with a clear message when the Docker CLI is missing or the engine is not running. */
export function requireDocker(script) {
  const cli = run('docker', ['--version'], { quiet: true });
  if (cli.status !== 0) {
    fail(
      script,
      'the Docker CLI was not found. Install Docker Desktop (Windows: with the WSL2 backend) or Docker Engine with Compose v2.',
    );
  }
  const engine = run('docker', ['info', '--format', '{{.ServerVersion}}'], {
    quiet: true,
  });
  if (engine.status !== 0) {
    fail(
      script,
      'Docker is installed but not running. Start Docker Desktop and try again.',
    );
  }
}

export function fail(script, message) {
  console.error(`${script}: ${message}`);
  process.exit(1);
}

export function log(script, message) {
  console.log(`${script}: ${message}`);
}
