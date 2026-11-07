import type { Preview } from '@storybook/react-vite';
import './poc.css';

const preview: Preview = {
  parameters: {
    // axe runs on every story; violations fail `test-storybook` (PoC-B-AC02; serious and critical
    // become merge-blocking in P1.4).
    a11y: { test: 'error' },
    controls: { matchers: { color: /(background|color)$/i } },
  },
};

export default preview;
