// Policy (Q-012, P1.7-T08): a tripwire, not a proof. Fails when code in the widget sends a payload
// that looks like visitor content: an object key `text`, `message`, `email` or `name` near a
// `sendBeacon(` or `fetch(` call in apps/widget/src or libs/chat-widget/src (tests and stories
// excluded). The ENDP-08 beacon carries only widgetKey, code, frameVersion and ts; T-06 asserts that.
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const DIRS = ['apps/widget/src', 'libs/chat-widget/src'];
const CALL = /\b(sendBeacon|fetch)\s*\(/;
const KEY = /(?:^|[{,\s])(text|message|email|name)\s*:/;
const WINDOW_BEFORE = 12;
const WINDOW_AFTER = 6;

const problems = [];
let calls = 0;
for (const dir of DIRS) {
  for (const rel of fs.readdirSync(path.join(root, dir), { recursive: true })) {
    if (!/\.(ts|tsx|js|mjs)$/.test(rel) || /\.(spec|test|stories)\./.test(rel))
      continue;
    const file = path.join(dir, rel);
    const lines = fs.readFileSync(path.join(root, file), 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (!CALL.test(line) || /^\s*(\/\/|\*)/.test(line)) return;
      calls++;
      const from = Math.max(0, i - WINDOW_BEFORE);
      for (
        let j = from;
        j <= Math.min(lines.length - 1, i + WINDOW_AFTER);
        j++
      ) {
        if (/^\s*(\/\/|\*)/.test(lines[j])) continue;
        const m = KEY.exec(lines[j]);
        if (m)
          problems.push(
            `${file.split(path.sep).join('/')}:${j + 1}: key "${m[1]}" near ${line.trim().slice(0, 60)} (line ${i + 1})`,
          );
      }
    });
  }
}

if (problems.length) {
  console.error(
    `check-telemetry-tripwire: possible visitor content in a network payload (Q-012). Remove it, or move the call away from unrelated keys:\n  ${problems.join('\n  ')}`,
  );
  process.exit(1);
}
console.log(
  `check-telemetry-tripwire: ${calls} network calls checked, no content keys nearby`,
);
