import { LIB_NAME, PLACEHOLDER_TAG, definePlaceholder } from './chat-widget';

describe('chat-widget', () => {
  it('P1.1-AC03 exposes its placeholder export', () => {
    expect(LIB_NAME).toBe('chat-widget');
  });

  it('defines the placeholder element once, even when called twice', () => {
    definePlaceholder();
    definePlaceholder();
    expect(customElements.get(PLACEHOLDER_TAG)).toBeDefined();
  });
});
