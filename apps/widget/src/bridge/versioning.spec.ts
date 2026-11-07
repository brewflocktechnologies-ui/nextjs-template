import fs from 'node:fs';
import path from 'node:path';
import { PROTOCOL_VERSION } from './protocol';

// P1.5-T08: the envelope version is defined once, in protocol.ts; nothing else hard-codes it.
describe('versioning (P1.5-T08)', () => {
  const src = path.join(import.meta.dirname, '..');
  const files = fs
    .readdirSync(src, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'))
    .filter((f) => path.basename(f) !== 'protocol.ts');

  it('PROTOCOL_VERSION is 1', () => {
    expect(PROTOCOL_VERSION).toBe(1);
  });

  it('no other source file writes an envelope version literal', () => {
    const offenders = files.filter((f) =>
      /\bv\s*:\s*1\b|\.v\s*===?\s*1\b/.test(
        fs.readFileSync(path.join(src, f), 'utf8'),
      ),
    );
    expect(offenders).toEqual([]);
  });
});
