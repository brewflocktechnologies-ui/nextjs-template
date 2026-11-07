import { PLAYGROUND_ORIGIN, WIDGET_ORIGIN } from './origins';

describe('playground origins (D-10)', () => {
  it('keeps the playground and the widget on different origins', () => {
    expect(new URL(PLAYGROUND_ORIGIN).origin).not.toBe(
      new URL(WIDGET_ORIGIN).origin,
    );
  });
});
