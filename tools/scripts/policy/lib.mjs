// Shared helpers for the policy scripts: base ref, changed files, trailers.
//
// Two modes (D-22):
// - Pull request (GITHUB_EVENT_PATH and GITHUB_BASE_REF set): trailers come from the PR body and
//   the diff is origin/<base>...HEAD.
// - Local: trailers come from the commit messages since `main` plus POLICY_TRAILERS (a
//   newline-separated string, for a check before committing), and the diff is main...working tree.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

export const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8' }).trim();

export function prContext() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const base = process.env.GITHUB_BASE_REF;
  if (!eventPath || !base || !fs.existsSync(eventPath)) return null;
  const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  return { base: `origin/${base}`, body: event.pull_request?.body ?? '' };
}

/** The ref to compare with: the PR base, or the local `main` branch. */
export function baseRef() {
  return prContext()?.base ?? 'main';
}

/** Text that may carry trailers such as `TESTS-REMOVED:`. */
export function trailerText() {
  const pr = prContext();
  if (pr) return pr.body;
  let log = '';
  try {
    log = git('log', '--format=%B', `${baseRef()}..HEAD`);
  } catch {
    // No main branch locally: only POLICY_TRAILERS counts.
  }
  return `${log}\n${process.env.POLICY_TRAILERS ?? ''}`;
}

export const hasTrailer = (name, text = trailerText()) =>
  new RegExp(`^${name}:\\s*\\S+`, 'm').test(text) &&
  !new RegExp(`^${name}:\\s*none\\s*$`, 'im').test(text);

/** Files that differ from the base: committed changes plus the working tree. */
export function changedFiles(filter = 'ACMRD') {
  const base = baseRef();
  const out = new Set();
  const add = (s) =>
    s
      .split('\n')
      .filter(Boolean)
      .forEach((f) => out.add(f));
  try {
    add(
      git('diff', '--name-only', `--diff-filter=${filter}`, `${base}...HEAD`),
    );
  } catch {
    return [];
  }
  if (!prContext())
    add(git('diff', '--name-only', `--diff-filter=${filter}`, 'HEAD'));
  return [...out];
}

/** A file's content at the base ref, or null when it did not exist there. */
export function atBase(file) {
  try {
    return execFileSync('git', ['show', `${baseRef()}:${file}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}
