import { LIB_NAME } from './design-tokens';

describe('design-tokens', () => {
  it('P1.1-AC03 exposes its placeholder export', () => {
    expect(LIB_NAME).toBe('design-tokens');
  });
});
