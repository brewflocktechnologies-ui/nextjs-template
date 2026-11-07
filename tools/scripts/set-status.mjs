// Updates one row of SPECS/STATUS.md (agent helper; agents never set Approved or Accepted
// on their own initiative, only when the product owner says so).
//
//   node tools/scripts/set-status.mjs <spec> <state> [--approval "Name, date"] [--started date]
//        [--evidence path] [--accepted "Name, date"] [--notes "text"]
//
// Fields not given keep their current value.
import fs from 'node:fs';

const [spec, state, ...rest] = process.argv.slice(2);
if (!spec || !state) {
  console.error('usage: set-status.mjs <spec> <state> [--field value]...');
  process.exit(1);
}
const opts = {};
for (let i = 0; i < rest.length; i += 2)
  opts[rest[i].replace(/^--/, '')] = rest[i + 1];

const file = 'SPECS/STATUS.md';
const lines = fs.readFileSync(file, 'utf8').split('\n');
const index = lines.findIndex((l) => l.split('|')[1]?.trim() === spec);
if (index < 0) {
  console.error(`no row for ${spec}`);
  process.exit(1);
}
// Columns: Spec | State | Approval | Started | Evidence | Accepted | Notes
const cells = lines[index]
  .split('|')
  .slice(1, -1)
  .map((c) => c.trim());
const next = [
  spec,
  state,
  opts.approval ?? cells[2],
  opts.started ?? cells[3],
  opts.evidence ?? cells[4],
  opts.accepted ?? cells[5],
  opts.notes ?? cells[6],
];
lines[index] = `| ${next.join(' | ')} |`;
fs.writeFileSync(file, lines.join('\n'));
console.log(lines[index]);
