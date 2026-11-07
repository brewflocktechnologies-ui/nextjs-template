import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from './ui/input';

/**
 * Deliberately inaccessible (P1.4-T07): an input with no label. Excluded from normal runs by
 * `!test`; `A11Y_NEGATIVE=1 pnpm nx run @byteflock/ui-react:test-storybook` runs only this story,
 * and axe must fail it. That proves accessibility violations block the run.
 */
const meta: Meta = {
  title: 'Checks/A11y negative',
  tags: ['!test', '!dev', 'a11y-negative'],
};
export default meta;

export const MissingLabel: StoryObj = {
  render: () => <Input />,
};
